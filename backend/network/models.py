from django.db import models


class Network(models.Model):
    class NetworkType(models.TextChoices):
        BRIDGE = "bridge", "Bridge"
        VLAN = "vlan", "VLAN"

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nom du réseau logique.",
    )

    network_type = models.CharField(
        max_length=20,
        choices=NetworkType.choices,
        default=NetworkType.BRIDGE,
    )

    bridge_name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nom du bridge Open vSwitch.",
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
        return self.name


class VLAN(models.Model):
    network = models.ForeignKey(
        Network,
        on_delete=models.CASCADE,
        related_name="vlans",
    )

    vlan_id = models.PositiveIntegerField(
        help_text="Identifiant du VLAN (1 à 4094).",
    )

    name = models.CharField(
        max_length=100,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["network", "vlan_id"],
                name="unique_vlan_per_network",
            ),
        ]

    def __str__(self):
        return f"{self.network.name} - VLAN {self.vlan_id}"


class NetworkInterface(models.Model):
    class InterfaceType(models.TextChoices):
        VIRTIO = "virtio", "VirtIO"
        E1000 = "e1000", "Intel E1000"
        OTHER = "other", "Autre"

    network = models.ForeignKey(
        Network,
        on_delete=models.CASCADE,
        related_name="interfaces",
    )

    resource_vmid = models.PositiveIntegerField(
        help_text="Identifiant VM/LXC dans Proxmox.",
    )

    interface_name = models.CharField(
        max_length=50,
        help_text="Nom de l'interface réseau, par exemple eth0.",
    )

    interface_type = models.CharField(
        max_length=20,
        choices=InterfaceType.choices,
        default=InterfaceType.VIRTIO,
    )

    mac_address = models.CharField(
        max_length=17,
        blank=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    vlan_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="VLAN associé à cette interface, si applicable.",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["resource_vmid", "interface_name"],
                name="unique_interface_per_resource",
            ),
        ]

    def __str__(self):
        return f"{self.resource_vmid} - {self.interface_name}"