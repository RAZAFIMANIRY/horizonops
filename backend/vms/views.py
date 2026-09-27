from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import ManagedResource
from .services import ProxmoxService
from .serializers import (
    VMSerializer,
    ContainerSerializer,
    ManagedResourceSerializer,
)


def get_proxmox_node():
    """
    Initialise le service Proxmox et récupère le premier nœud disponible.
    """
    proxmox = ProxmoxService()
    nodes = proxmox.get_nodes()

    if not nodes:
        raise Exception("Aucun nœud Proxmox disponible.")

    return proxmox, nodes[0]["node"]


class VMListAPIView(APIView):
    """
    Retourne la liste des machines virtuelles présentes dans Proxmox.
    """

    def get(self, request):
        try:
            proxmox, node = get_proxmox_node()

            vms = proxmox.get_vms(node)

            return Response(
                VMSerializer(vms, many=True).data,
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class VMCreateAPIView(APIView):
    """
    Crée une machine virtuelle dans Proxmox
    puis enregistre ses informations dans PostgreSQL.
    """

    def post(self, request):
        try:
            data = request.data

            required_fields = [
                "vmid",
                "name",
                "memory",
                "cores",
                "disk",
                "iso",
            ]

            missing_fields = [
                field
                for field in required_fields
                if field not in data
                or data[field] in ("", None)
            ]

            if missing_fields:
                return Response(
                    {
                        "error": "Paramètres manquants.",
                        "fields": missing_fields,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Conversion et validation des paramètres numériques
            try:
                vmid = int(data["vmid"])
                memory = int(data["memory"])
                cores = int(data["cores"])
                disk = int(data["disk"])
            except (TypeError, ValueError):
                return Response(
                    {
                        "error": (
                            "vmid, memory, cores et disk "
                            "doivent être des nombres entiers."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if vmid <= 0:
                return Response(
                    {"error": "Le VMID doit être supérieur à 0."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if memory <= 0:
                return Response(
                    {"error": "La mémoire doit être supérieure à 0 Mo."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if cores <= 0:
                return Response(
                    {"error": "Le nombre de cœurs doit être supérieur à 0."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if disk <= 0:
                return Response(
                    {"error": "La taille du disque doit être supérieure à 0 Go."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Vérification dans PostgreSQL
            if ManagedResource.objects.filter(vmid=vmid).exists():
                return Response(
                    {
                        "error": (
                            f"La ressource {vmid} "
                            "existe déjà dans HorizonOps."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Connexion à Proxmox
            proxmox, node = get_proxmox_node()

            # Création réelle de la VM dans Proxmox
            result = proxmox.create_vm(
                node=node,
                vmid=vmid,
                name=data["name"],
                memory=memory,
                cores=cores,
                disk=disk,
                iso=data["iso"],
                bridge=data.get("bridge"),
                vlan=data.get("vlan"),
            )

            # Enregistrement de la VM dans PostgreSQL
            resource = ManagedResource.objects.create(
                vmid=vmid,
                name=data["name"],
                resource_type=ManagedResource.ResourceType.VM,
                node=node,
                cpu_cores=cores,
                memory_mb=memory,
                disk_gb=disk,
                operating_system=data.get(
                    "operating_system",
                    "",
                ),
                ip_address=data.get("ip_address"),
                power_state=ManagedResource.PowerState.STOPPED,
                description=data.get(
                    "description",
                    "",
                ),
            )

            return Response(
                {
                    "message": (
                        f"VM {vmid} créée avec succès."
                    ),
                    "data": result,
                    "resource": ManagedResourceSerializer(
                        resource
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ISOListAPIView(APIView):
    """
    Retourne la liste des images ISO disponibles dans Proxmox.
    """

    def get(self, request):
        try:
            proxmox, node = get_proxmox_node()

            isos = proxmox.get_isos(node)

            return Response(
                isos,
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class VMActionAPIView(APIView):
    """
    Exécute une action sur une VM :
    start, stop ou reboot.

    L'état PostgreSQL est mis à jour uniquement
    lorsque l'action Proxmox réussit.
    """

    def post(self, request, vmid, action):
        try:
            # Validation du VMID
            try:
                vmid = int(vmid)
            except (TypeError, ValueError):
                return Response(
                    {"error": "VMID invalide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            actions = {
                "start": "start_vm",
                "stop": "stop_vm",
                "reboot": "reboot_vm",
            }

            if action not in actions:
                return Response(
                    {
                        "error": (
                            "Action inconnue. "
                            "Actions disponibles : "
                            "start, stop, reboot."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            proxmox, node = get_proxmox_node()

            # Récupération de la méthode Proxmox
            proxmox_action = getattr(
                proxmox,
                actions[action],
            )

            # Exécution de l'action sur Proxmox
            result = proxmox_action(node, vmid)

            # Mise à jour PostgreSQL
            database_updated = False

            try:
                resource = ManagedResource.objects.get(
                    vmid=vmid
                )

                if action == "start":
                    resource.power_state = (
                        ManagedResource.PowerState.RUNNING
                    )

                elif action == "stop":
                    resource.power_state = (
                        ManagedResource.PowerState.STOPPED
                    )

                elif action == "reboot":
                    resource.power_state = (
                        ManagedResource.PowerState.RUNNING
                    )

                resource.save(
                    update_fields=[
                        "power_state",
                        "updated_at",
                    ]
                )

                database_updated = True

            except ManagedResource.DoesNotExist:
                database_updated = False

            return Response(
                {
                    "message": (
                        f"VM {vmid} : "
                        f"{action} exécuté avec succès."
                    ),
                    "data": result,
                    "database_updated": database_updated,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VMDetailAPIView(APIView):
    """
    Retourne la configuration et l'état actuel d'une VM.
    """

    def get(self, request, vmid):
        try:
            vmid = int(vmid)

            proxmox, node = get_proxmox_node()

            config = proxmox.get_vm(
                node,
                vmid,
            )

            status_data = proxmox.get_vm_status(
                node,
                vmid,
            )

            return Response(
                {
                    "vmid": vmid,
                    "node": node,
                    "config": config,
                    "status": status_data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_404_NOT_FOUND,
            )


class VMDeleteAPIView(APIView):
    """
    Supprime une VM de Proxmox puis de PostgreSQL.
    """

    def delete(self, request, vmid):
        try:
            vmid = int(vmid)

            proxmox, node = get_proxmox_node()

            # Suppression réelle dans Proxmox
            result = proxmox.delete_vm(
                node,
                vmid,
            )

            # Suppression dans PostgreSQL
            database_deleted = False

            try:
                resource = ManagedResource.objects.get(
                    vmid=vmid
                )

                resource.delete()
                database_deleted = True

            except ManagedResource.DoesNotExist:
                database_deleted = False

            return Response(
                {
                    "message": (
                        f"VM {vmid} supprimée avec succès."
                    ),
                    "data": result,
                    "database_deleted": database_deleted,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ContainerListAPIView(APIView):
    """
    Retourne la liste des conteneurs LXC présents dans Proxmox.
    """

    def get(self, request):
        try:
            proxmox, node = get_proxmox_node()

            containers = proxmox.get_containers(node)

            return Response(
                ContainerSerializer(
                    containers,
                    many=True,
                ).data,
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class ContainerActionAPIView(APIView):
    """
    Exécute une action sur un conteneur LXC :
    start, stop ou reboot.

    L'état PostgreSQL est également synchronisé.
    """

    def post(self, request, vmid, action):
        try:
            try:
                vmid = int(vmid)
            except (TypeError, ValueError):
                return Response(
                    {"error": "VMID invalide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            actions = {
                "start": "start_container",
                "stop": "stop_container",
                "reboot": "reboot_container",
            }

            if action not in actions:
                return Response(
                    {
                        "error": (
                            "Action inconnue. "
                            "Actions disponibles : "
                            "start, stop, reboot."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            proxmox, node = get_proxmox_node()

            # Récupération de la méthode Proxmox
            proxmox_action = getattr(
                proxmox,
                actions[action],
            )

            # Exécution de l'action dans Proxmox
            result = proxmox_action(
                node,
                vmid,
            )

            # Mise à jour PostgreSQL
            database_updated = False

            try:
                resource = ManagedResource.objects.get(
                    vmid=vmid
                )

                # Vérification qu'il s'agit bien d'un LXC
                if resource.resource_type == (
                    ManagedResource.ResourceType.LXC
                ):
                    if action == "start":
                        resource.power_state = (
                            ManagedResource.PowerState.RUNNING
                        )

                    elif action == "stop":
                        resource.power_state = (
                            ManagedResource.PowerState.STOPPED
                        )

                    elif action == "reboot":
                        resource.power_state = (
                            ManagedResource.PowerState.RUNNING
                        )

                    resource.save(
                        update_fields=[
                            "power_state",
                            "updated_at",
                        ]
                    )

                    database_updated = True

            except ManagedResource.DoesNotExist:
                database_updated = False

            return Response(
                {
                    "message": (
                        f"LXC {vmid} : "
                        f"{action} exécuté avec succès."
                    ),
                    "data": result,
                    "database_updated": database_updated,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
class VMSnapshotListCreateAPIView(APIView):
    """
    Liste ou crée les snapshots d'une VM QEMU.
    """

    def get(self, request, vmid):
        try:
            vmid = int(vmid)

            proxmox, node = get_proxmox_node()

            snapshots = proxmox.get_snapshots(
                node=node,
                vmid=vmid,
                resource_type="qemu",
            )

            return Response(
                {
                    "vmid": vmid,
                    "node": node,
                    "resource_type": "qemu",
                    "snapshots": snapshots,
                },
                status=status.HTTP_200_OK,
            )

        except ValueError:
            return Response(
                {"error": "VMID invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def post(self, request, vmid):
        try:
            vmid = int(vmid)

            snapname = request.data.get("snapname")
            description = request.data.get(
                "description",
                "",
            )

            if not snapname:
                return Response(
                    {
                        "error": (
                            "Le nom du snapshot "
                            "est obligatoire."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            proxmox, node = get_proxmox_node()

            result = proxmox.create_snapshot(
                node=node,
                vmid=vmid,
                snapname=snapname,
                description=description,
                resource_type="qemu",
            )

            return Response(
                {
                    "message": (
                        f"Snapshot '{snapname}' "
                        f"créé avec succès pour la VM {vmid}."
                    ),
                    "data": result,
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError:
            return Response(
                {"error": "VMID invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VMSnapshotDeleteAPIView(APIView):
    """
    Supprime un snapshot d'une VM QEMU.
    """

    def delete(self, request, vmid, snapname):
        try:
            vmid = int(vmid)

            if not snapname:
                return Response(
                    {
                        "error": (
                            "Le nom du snapshot "
                            "est obligatoire."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            proxmox, node = get_proxmox_node()

            result = proxmox.delete_snapshot(
                node=node,
                vmid=vmid,
                snapname=snapname,
                resource_type="qemu",
            )

            return Response(
                {
                    "message": (
                        f"Snapshot '{snapname}' "
                        f"supprimé avec succès."
                    ),
                    "data": result,
                },
                status=status.HTTP_200_OK,
            )

        except ValueError:
            return Response(
                {"error": "VMID invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VMSnapshotRollbackAPIView(APIView):
    """
    Restaure une VM QEMU depuis un snapshot.
    """

    def post(self, request, vmid, snapname):
        try:
            vmid = int(vmid)

            if not snapname:
                return Response(
                    {
                        "error": (
                            "Le nom du snapshot "
                            "est obligatoire."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            proxmox, node = get_proxmox_node()

            result = proxmox.rollback_snapshot(
                node=node,
                vmid=vmid,
                snapname=snapname,
                resource_type="qemu",
            )

            return Response(
                {
                    "message": (
                        f"VM {vmid} restaurée depuis "
                        f"le snapshot '{snapname}'."
                    ),
                    "data": result,
                },
                status=status.HTTP_200_OK,
            )

        except ValueError:
            return Response(
                {"error": "VMID invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )