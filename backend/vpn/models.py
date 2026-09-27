from django.db import models


class WireGuardTunnel(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nom du tunnel WireGuard.",
    )

    interface_name = models.CharField(
        max_length=50,
        unique=True,
        default="wg0",
        help_text="Nom de l'interface WireGuard.",
    )

    address = models.GenericIPAddressField(
        help_text="Adresse IPv4 du tunnel WireGuard.",
    )

    listen_port = models.PositiveIntegerField(
        default=51820,
        help_text="Port d'écoute UDP de WireGuard.",
    )

    network = models.CharField(
        max_length=50,
        help_text="Réseau VPN, par exemple 10.8.0.0/24.",
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


class WireGuardPeer(models.Model):
    tunnel = models.ForeignKey(
        WireGuardTunnel,
        on_delete=models.CASCADE,
        related_name="peers",
    )

    name = models.CharField(
        max_length=100,
        help_text="Nom du pair WireGuard.",
    )

    public_key = models.CharField(
        max_length=64,
        unique=True,
        help_text="Clé publique du pair.",
    )

    allowed_ips = models.JSONField(
        default=list,
        blank=True,
        help_text="Adresses ou réseaux autorisés pour ce pair.",
    )

    endpoint = models.CharField(
        max_length=255,
        blank=True,
        help_text="Adresse endpoint du pair, si nécessaire.",
    )

    persistent_keepalive = models.PositiveIntegerField(
        default=25,
        help_text="Intervalle Keepalive en secondes.",
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
        return f"{self.name} - {self.tunnel.name}"