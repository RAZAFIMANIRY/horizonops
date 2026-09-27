from django.db import models


class MonitoringTarget(models.Model):
    class TargetType(models.TextChoices):
        PROXMOX = "proxmox", "Proxmox VE"
        VM = "vm", "Machine virtuelle"
        LXC = "lxc", "Conteneur LXC"
        DOCKER = "docker", "Conteneur Docker"
        NETWORK = "network", "Réseau"

    class TargetStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        UNKNOWN = "unknown", "Inconnu"

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nom de la cible de supervision.",
    )

    target_type = models.CharField(
        max_length=20,
        choices=TargetType.choices,
    )

    endpoint = models.CharField(
        max_length=255,
        blank=True,
        help_text="Adresse ou endpoint utilisé pour la supervision.",
    )

    prometheus_job = models.CharField(
        max_length=100,
        blank=True,
        help_text="Nom du job Prometheus associé.",
    )

    status = models.CharField(
        max_length=20,
        choices=TargetStatus.choices,
        default=TargetStatus.UNKNOWN,
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


class AlertRule(models.Model):
    class Severity(models.TextChoices):
        INFO = "info", "Information"
        WARNING = "warning", "Avertissement"
        CRITICAL = "critical", "Critique"

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nom de la règle d'alerte.",
    )

    target = models.ForeignKey(
        MonitoringTarget,
        on_delete=models.CASCADE,
        related_name="alert_rules",
    )

    metric = models.CharField(
        max_length=100,
        help_text="Métrique surveillée, par exemple CPU ou mémoire.",
    )

    condition = models.CharField(
        max_length=255,
        help_text="Condition de déclenchement de l'alerte.",
    )

    threshold = models.FloatField(
        help_text="Seuil de déclenchement.",
    )

    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.WARNING,
    )

    enabled = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name


class AlertHistory(models.Model):
    class Status(models.TextChoices):
        FIRING = "firing", "Déclenchée"
        RESOLVED = "resolved", "Résolue"

    rule = models.ForeignKey(
        AlertRule,
        on_delete=models.CASCADE,
        related_name="history",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    value = models.FloatField(
        null=True,
        blank=True,
        help_text="Valeur de la métrique au moment du déclenchement.",
    )

    message = models.TextField(
        blank=True,
    )

    triggered_at = models.DateTimeField(
        auto_now_add=True,
    )

    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.rule.name} - {self.status}"