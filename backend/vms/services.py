import os
import requests


class ProxmoxService:
    def __init__(self):
        self.host = os.getenv("PROXMOX_HOST")
        self.port = os.getenv("PROXMOX_PORT", "8006")
        self.token_id = os.getenv("PROXMOX_TOKEN_ID")
        self.token_secret = os.getenv("PROXMOX_TOKEN_SECRET")

        self.verify_ssl = (
            os.getenv("PROXMOX_VERIFY_SSL", "False").lower() == "true"
        )

        self.base_url = f"https://{self.host}:{self.port}/api2/json"

    @property
    def headers(self):
        return {
            "Authorization": (
                f"PVEAPIToken={self.token_id}={self.token_secret}"
            )
        }

    def request(self, method, endpoint, **kwargs):
        response = requests.request(
            method,
            f"{self.base_url}{endpoint}",
            headers=self.headers,
            verify=self.verify_ssl,
            timeout=15,
            **kwargs,
        )

        response.raise_for_status()

        return response.json().get("data")

    # -------------------------
    # NODES
    # -------------------------

    def get_nodes(self):
        return self.request("GET", "/nodes")

        # -------------------------
    # ISO
    # -------------------------

    def get_isos(self, node):
        """
        Retourne toutes les images ISO disponibles
        sur les stockages Proxmox du nœud.
        """

        storages = self.request(
            "GET",
            f"/nodes/{node}/storage"
        )

        isos = []

        for storage in storages:
            storage_id = storage.get("storage")

            if not storage_id:
                continue

            try:
                contents = self.request(
                    "GET",
                    f"/nodes/{node}/storage/{storage_id}/content",
                    params={"content": "iso"},
                )

                for iso in contents:
                    volid = iso.get("volid")

                    if not volid:
                        continue

                    isos.append({
                        "volid": volid,
                        "name": volid.split("/")[-1],
                        "storage": storage_id,
                        "size": iso.get("size", 0),
                    })

            except requests.RequestException:
                # Certains stockages peuvent ne pas accepter
                # le contenu ISO. On passe simplement au suivant.
                continue

        return isos
    # -------------------------
    # VM
    # -------------------------

    def create_vm(
        self,
        node,
        vmid,
        name,
        memory,
        cores,
        disk,
        iso,
        bridge=None,
        vlan=None,
    ):
        """
        Crée une machine virtuelle QEMU sur Proxmox.
        """

        params = {
            "vmid": vmid,
            "name": name,
            "memory": memory,
            "cores": cores,
            "scsihw": "virtio-scsi-pci",
            "scsi0": f"local-lvm:{disk}",
            "ide2": f"{iso},media=cdrom",
            "boot": "order=scsi0",
        }

        if bridge:
            net0 = f"virtio,bridge={bridge}"

            if vlan is not None:
                net0 += f",tag={vlan}"

            params["net0"] = net0

        return self.request(
            "POST",
            f"/nodes/{node}/qemu",
            data=params,
        )

    def get_vms(self, node):
        return self.request("GET", f"/nodes/{node}/qemu")

    def get_vm(self, node, vmid):
        return self.request("GET", f"/nodes/{node}/qemu/{vmid}/config")

    def get_vm_status(self, node, vmid):
        return self.request(
            "GET",
            f"/nodes/{node}/qemu/{vmid}/status/current"
        )

    def start_vm(self, node, vmid):
        return self.request(
            "POST",
            f"/nodes/{node}/qemu/{vmid}/status/start"
        )

    def stop_vm(self, node, vmid):
        return self.request(
            "POST",
            f"/nodes/{node}/qemu/{vmid}/status/stop"
        )

    def reboot_vm(self, node, vmid):
        return self.request(
            "POST",
            f"/nodes/{node}/qemu/{vmid}/status/reboot"
        )

    def delete_vm(self, node, vmid):
        return self.request(
            "DELETE",
            f"/nodes/{node}/qemu/{vmid}"
        )

    # -------------------------
    # LXC
    # -------------------------

    def get_containers(self, node):
        return self.request("GET", f"/nodes/{node}/lxc")

    def get_container_status(self, node, vmid):
        return self.request(
            "GET",
            f"/nodes/{node}/lxc/{vmid}/status/current"
        )

    def start_container(self, node, vmid):
        return self.request(
            "POST",
            f"/nodes/{node}/lxc/{vmid}/status/start"
        )

    def stop_container(self, node, vmid):
        return self.request(
            "POST",
            f"/nodes/{node}/lxc/{vmid}/status/stop"
        )

    def reboot_container(self, node, vmid):
        return self.request(
            "POST",
            f"/nodes/{node}/lxc/{vmid}/status/reboot"
        )

    def delete_container(self, node, vmid):
        return self.request(
            "DELETE",
            f"/nodes/{node}/lxc/{vmid}"
        )

        # -------------------------
    # SNAPSHOTS
    # -------------------------

    def get_snapshots(self, node, vmid, resource_type="qemu"):
        """
        Retourne la liste des snapshots d'une VM QEMU
        ou d'un conteneur LXC.
        """

        if resource_type not in ("qemu", "lxc"):
            raise ValueError(
                "resource_type doit être 'qemu' ou 'lxc'."
            )

        return self.request(
            "GET",
            f"/nodes/{node}/{resource_type}/{vmid}/snapshot"
        )

    def create_snapshot(
        self,
        node,
        vmid,
        snapname,
        description="",
        resource_type="qemu",
    ):
        """
        Crée un snapshot sur une VM QEMU ou un conteneur LXC.
        """

        if resource_type not in ("qemu", "lxc"):
            raise ValueError(
                "resource_type doit être 'qemu' ou 'lxc'."
            )

        if not snapname:
            raise ValueError(
                "Le nom du snapshot est obligatoire."
            )

        params = {
            "snapname": snapname,
        }

        if description:
            params["description"] = description

        return self.request(
            "POST",
            f"/nodes/{node}/{resource_type}/{vmid}/snapshot",
            data=params,
        )

    def delete_snapshot(
        self,
        node,
        vmid,
        snapname,
        resource_type="qemu",
    ):
        """
        Supprime un snapshot.
        """

        if resource_type not in ("qemu", "lxc"):
            raise ValueError(
                "resource_type doit être 'qemu' ou 'lxc'."
            )

        return self.request(
            "DELETE",
            f"/nodes/{node}/{resource_type}/{vmid}/snapshot/{snapname}"
        )

    def rollback_snapshot(
        self,
        node,
        vmid,
        snapname,
        resource_type="qemu",
    ):
        """
        Restaure une VM ou un conteneur
        à partir d'un snapshot.
        """

        if resource_type not in ("qemu", "lxc"):
            raise ValueError(
                "resource_type doit être 'qemu' ou 'lxc'."
            )

        return self.request(
            "POST",
            f"/nodes/{node}/{resource_type}/{vmid}/snapshot/{snapname}/rollback"
        )

    # -------------------------
    # NODE STATUS
    # -------------------------

    def get_node_status(self, node):
        return self.request(
            "GET",
            f"/nodes/{node}/status"
        )

    def get_storage_metrics(self):
        return {
            "size": self.query(
                'pve_disk_size_bytes{id=~"storage/.+"}'
            ),
            "usage": self.query(
                'pve_disk_usage_bytes{id=~"storage/.+"}'
            ),
        }


    def get_network_metrics(self):
        return {
            "receive": self.query(
                'pve_network_receive_bytes_total'
            ),
            "transmit": self.query(
                'pve_network_transmit_bytes_total'
            ),
        }