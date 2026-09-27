from django.db import models


class ManagedResource(models.Model):
    class ResourceType(models.TextChoices):
        VM = "VM", "Machine virtuelle"
        LXC = "LXC", "Conteneur LXC"

    class PowerState(models.TextChoices):
        RUNNING = "running", "En fonctionnement"
        STOPPED = "stopped", "Arrêtée"
        UNKNOWN = "unknown", "Inconnu"

    vmid = models.PositiveIntegerField(
        unique=True,
        help_text="Identifiant unique de la ressource dans Proxmox.",
    )

    name = models.CharField(
        max_length=100,
        help_text="Nom de la VM ou du conteneur.",
    )

    resource_type = models.CharField(
        max_length=3,
        choices=ResourceType.choices,
    )

    node = models.CharField(
        max_length=100,
        help_text="Nom du nœud Proxmox hébergeant la ressource.",
    )

    cpu_cores = models.PositiveIntegerField(
        default=1,
        help_text="Nombre de cœurs CPU configurés.",
    )

    memory_mb = models.PositiveIntegerField(
        help_text="Mémoire RAM configurée en Mo.",
    )

    disk_gb = models.PositiveIntegerField(
        default=10,
        help_text="Taille du disque en Go.",
    )

    operating_system = models.CharField(
        max_length=100,
        blank=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    power_state = models.CharField(
        max_length=10,
        choices=PowerState.choices,
        default=PowerState.UNKNOWN,
    )

    description = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.name} ({self.resource_type})"