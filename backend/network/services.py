import subprocess

from .models import Network


class OVSService:
    """
    Service de gestion d'Open vSwitch.

    Les commandes ovs-vsctl sont exécutées avec sudo
    sans demande interactive de mot de passe.
    """

    OVSCTL = "/usr/bin/ovs-vsctl"

    def run_command(self, *args):
        command = [
            "sudo",
            "-n",
            self.OVSCTL,
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
                or "Erreur lors de l'exécution de la commande OVS."
            )

        return result.stdout.strip()

    def get_version(self):
        return self.run_command("--version")

    def get_bridges(self):
        output = self.run_command("list-br")
        return output.splitlines() if output else []

    def get_ports(self, bridge):
        output = self.run_command("list-ports", bridge)
        return output.splitlines() if output else []

    def get_show(self):
        return self.run_command("show")

    def create_bridge(self, bridge):
        result = self.run_command(
            "--may-exist",
            "add-br",
            bridge,
        )

        self.sync_bridge_to_database(bridge)

        return result

    def delete_bridge(self, bridge):
        result = self.run_command(
            "--if-exists",
            "del-br",
            bridge,
        )

        Network.objects.filter(
            bridge_name=bridge
        ).delete()

        return result

    def add_port(self, bridge, port):
        return self.run_command(
            "--may-exist",
            "add-port",
            bridge,
            port,
        )

    def delete_port(self, bridge, port):
        return self.run_command(
            "--if-exists",
            "del-port",
            bridge,
            port,
        )

    def sync_bridge_to_database(self, bridge):
        """
        Synchronise un bridge OVS avec PostgreSQL.

        Le bridge OVS devient un réseau logique
        de type bridge dans HorizonOps.
        """

        network, created = Network.objects.update_or_create(
            bridge_name=bridge,
            defaults={
                "name": bridge,
                "network_type": Network.NetworkType.BRIDGE,
            },
        )

        return network, created

    def sync_all_bridges_to_database(self):
        """
        Synchronise tous les bridges OVS avec PostgreSQL.
        """

        bridges = self.get_bridges()

        synchronized = []

        for bridge in bridges:
            network, created = (
                self.sync_bridge_to_database(
                    bridge
                )
            )

            synchronized.append({
                "id": network.id,
                "name": network.name,
                "bridge_name": network.bridge_name,
                "created": created,
            })

        return synchronized