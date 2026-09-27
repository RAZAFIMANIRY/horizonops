import subprocess

from .models import WireGuardTunnel, WireGuardPeer


class WireGuardService:
    """
    Service de gestion de WireGuard.

    Les commandes sont exécutées côté backend
    avec une autorisation sudo limitée.
    """

    WG = "/usr/bin/wg"
    WG_QUICK = "/usr/bin/wg-quick"

    def run_wg(self, *args):
        command = [
            "sudo",
            "-n",
            self.WG,
            *args,
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                result.stderr.strip()
                or "Erreur lors de l'exécution de WireGuard."
            )

        return result.stdout.strip()

    def run_wg_quick(self, action, interface):
        command = [
            "sudo",
            "-n",
            self.WG_QUICK,
            action,
            interface,
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                result.stderr.strip()
                or f"Erreur wg-quick {action}."
            )

        return result.stdout.strip()

    def get_interfaces(self):
        output = self.run_wg(
            "show",
            "interfaces",
        )

        return output.split() if output else []

    def get_interface(self, interface):
        output = self.run_wg(
            "show",
            interface,
        )

        return self.parse_output(output)

    def get_all(self):
        return [
            self.get_interface(interface)
            for interface in self.get_interfaces()
        ]

    def parse_output(self, output):
        data = {
            "interface": None,
            "public_key": None,
            "listen_port": None,
            "fwmark": None,
            "peers": [],
        }

        current_peer = None

        for line in output.splitlines():

            line = line.strip()

            if not line:
                continue

            if line.startswith("interface:"):
                data["interface"] = line.split(
                    ":",
                    1,
                )[1].strip()

            elif line.startswith("public key:"):
                data["public_key"] = line.split(
                    ":",
                    1,
                )[1].strip()

            elif line.startswith("private key:"):
                # La clé privée n'est jamais exposée.
                continue

            elif line.startswith("listening port:"):
                data["listen_port"] = int(
                    line.split(
                        ":",
                        1,
                    )[1].strip()
                )

            elif line.startswith("fwmark:"):
                data["fwmark"] = line.split(
                    ":",
                    1,
                )[1].strip()

            elif line.startswith("peer:"):

                current_peer = {
                    "public_key": line.split(
                        ":",
                        1,
                    )[1].strip(),
                    "endpoint": None,
                    "allowed_ips": [],
                    "latest_handshake": None,
                    "transfer_rx": 0,
                    "transfer_tx": 0,
                }

                data["peers"].append(
                    current_peer
                )

            elif current_peer is not None:

                if line.startswith("endpoint:"):

                    current_peer["endpoint"] = (
                        line.split(
                            ":",
                            1,
                        )[1].strip()
                    )

                elif line.startswith("allowed ips:"):

                    allowed_ips = line.split(
                        ":",
                        1,
                    )[1].strip()

                    current_peer["allowed_ips"] = [
                        item.strip()
                        for item in allowed_ips.split(",")
                        if item.strip()
                    ]

                elif line.startswith(
                    "latest handshake:"
                ):

                    current_peer[
                        "latest_handshake"
                    ] = line.split(
                        ":",
                        1,
                    )[1].strip()

                elif line.startswith("transfer:"):

                    transfer = line.split(
                        ":",
                        1,
                    )[1].strip()

                    for item in transfer.split(","):

                        item = item.strip()

                        if item.startswith("received"):

                            current_peer[
                                "transfer_rx"
                            ] = item.replace(
                                "received",
                                "",
                            ).strip()

                        elif item.startswith("sent"):

                            current_peer[
                                "transfer_tx"
                            ] = item.replace(
                                "sent",
                                "",
                            ).strip()

        return data

    def get_status(self, interface):
        interfaces = self.get_interfaces()

        return {
            "interface": interface,
            "up": interface in interfaces,
        }

    def interface_up(self, interface):
        return self.run_wg_quick(
            "up",
            interface,
        )

    def interface_down(self, interface):
        return self.run_wg_quick(
            "down",
            interface,
        )

    def add_peer(
        self,
        interface,
        public_key,
        allowed_ips,
        endpoint=None,
        persistent_keepalive=None,
    ):
        if isinstance(
            allowed_ips,
            list,
        ):
            allowed_ips = ",".join(
                allowed_ips
            )

        command = [
            "set",
            interface,
            "peer",
            public_key,
            "allowed-ips",
            allowed_ips,
        ]

        if endpoint:
            command.extend([
                "endpoint",
                endpoint,
            ])

        if persistent_keepalive:
            command.extend([
                "persistent-keepalive",
                str(persistent_keepalive),
            ])

        return self.run_wg(*command)

    def remove_peer(
        self,
        interface,
        public_key,
    ):
        return self.run_wg(
            "set",
            interface,
            "peer",
            public_key,
            "remove",
        )

    def sync_interface_to_database(
        self,
        interface,
    ):
        """
        Synchronise une interface WireGuard
        avec PostgreSQL.
        """

        data = self.get_interface(
            interface
        )

        tunnel, created = (
            WireGuardTunnel.objects.update_or_create(
                interface_name=interface,
                defaults={
                    "name": interface,
                    "address": self.get_interface_address(
                        interface
                    ),
                    "listen_port": (
                        data["listen_port"]
                        or 51820
                    ),
                },
            )
        )

        for peer in data["peers"]:

            WireGuardPeer.objects.update_or_create(
                public_key=peer["public_key"],
                defaults={
                    "tunnel": tunnel,
                    "name": peer["public_key"][:12],
                    "allowed_ips": peer["allowed_ips"],
                    "endpoint": (
                        peer["endpoint"]
                        or ""
                    ),
                },
            )

        return tunnel

    def get_interface_address(self, interface):
        """
        Récupère l'adresse IPv4 de l'interface WireGuard.
        """

        command = [
            "ip",
            "-4",
            "addr",
            "show",
            "dev",
            interface,
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

        if result.returncode != 0:
            return "0.0.0.0"

        for line in result.stdout.splitlines():

            line = line.strip()

            if line.startswith("inet "):

                address = line.split()[1]

                return address.split(
                    "/",
                    1,
                )[0]

        return "0.0.0.0"

    def sync_all_to_database(self):
        """
        Synchronise toutes les interfaces WireGuard
        actives avec PostgreSQL.
        """

        interfaces = self.get_interfaces()

        synchronized = []

        for interface in interfaces:

            tunnel = (
                self.sync_interface_to_database(
                    interface
                )
            )

            synchronized.append(
                tunnel
            )

        return synchronized