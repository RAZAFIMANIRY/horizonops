from django.db import models


class DockerContainer(models.Model):
    class ContainerStatus(models.TextChoices):
        RUNNING = "running", "En fonctionnement"
        STOPPED = "stopped", "Arrêté"
        PAUSED = "paused", "En pause"
        RESTARTING = "restarting", "Redémarrage"
        EXITED = "exited", "Terminé"
        CREATED = "created", "Créé"
        UNKNOWN = "unknown", "Inconnu"

    container_id = models.CharField(
        max_length=64,
        unique=True,
        help_text="Identifiant unique du conteneur Docker.",
    )

    name = models.CharField(
        max_length=100,
        help_text="Nom du conteneur Docker.",
    )

    image = models.CharField(
        max_length=255,
        help_text="Image Docker utilisée par le conteneur.",
    )

    status = models.CharField(
        max_length=20,
        choices=ContainerStatus.choices,
        default=ContainerStatus.UNKNOWN,
    )

    ports = models.JSONField(
        default=dict,
        blank=True,
        help_text="Mapping des ports exposés par le conteneur.",
    )

    environment = models.JSONField(
        default=dict,
        blank=True,
        help_text="Variables d'environnement du conteneur.",
    )

    restart_policy = models.CharField(
        max_length=50,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name