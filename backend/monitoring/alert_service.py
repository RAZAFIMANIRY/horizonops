from django.utils import timezone

from .models import AlertRule, AlertHistory
from .services import PrometheusService


class AlertService:
    """
    Service responsable de l'évaluation des règles d'alerte
    à partir des métriques Prometheus.

    Chaque règle est associée à une MonitoringTarget.
    La cible est utilisée pour filtrer les séries Prometheus
    à partir de :
        - prometheus_job
        - endpoint
    """

    def __init__(self):
        """
        Initialise le service Prometheus utilisé pour
        interroger les métriques.
        """
        self.prometheus = PrometheusService()
    # =========================================================
    # REQUÊTES PROMQL DE BASE
    # =========================================================

    METRIC_QUERIES = {
        "cpu": (
            '100 - ('
            'avg by (instance) '
            '(rate(node_cpu_seconds_total{MODE_FILTER}[5m])) '
            '* 100)'
        ),

        "memory": (
            '(1 - ('
            'node_memory_MemAvailable_bytes{TARGET_FILTER}'
            ' / '
            'node_memory_MemTotal_bytes{TARGET_FILTER}'
            ')) * 100'
        ),

        "storage": (
            '(1 - ('
            'node_filesystem_avail_bytes'
            '{TARGET_FILTER, fstype!~"tmpfs|overlay|squashfs"}'
            ' / '
            'node_filesystem_size_bytes'
            '{TARGET_FILTER, fstype!~"tmpfs|overlay|squashfs"}'
            ')) * 100'
        ),
    }

    # =========================================================
    # ALIAS DES MÉTRIQUES
    # =========================================================

    METRIC_ALIASES = {
        "cpu": "cpu",
        "cpu_usage": "cpu",
        "cpu_utilization": "cpu",

        "memory": "memory",
        "mem": "memory",
        "ram": "memory",
        "memory_usage": "memory",

        "storage": "storage",
        "disk": "storage",
        "disk_usage": "storage",
    }

    # =========================================================
    # NORMALISATION DE LA MÉTRIQUE
    # =========================================================

    def normalize_metric(self, metric):
        """
        Convertit différents noms de métriques vers
        un nom interne standardisé.
        """

        if not metric:
            return None

        metric = str(metric).strip().lower()

        return self.METRIC_ALIASES.get(metric)

    # =========================================================
    # ÉCHAPPEMENT PROMQL
    # =========================================================

    def escape_promql_value(self, value):
        """
        Échappe une valeur avant de l'insérer dans
        une expression PromQL.

        Exemple :
            host.docker.internal:9100
        devient une valeur sûre pour :
            instance="host.docker.internal:9100"
        """

        if value is None:
            return ""

        value = str(value).strip()

        return (
            value
            .replace("\\", "\\\\")
            .replace('"', '\\"')
        )

    # =========================================================
    # CONSTRUCTION DU FILTRE DE CIBLE
    # =========================================================

    def build_target_filter(self, target):
        """
        Construit le filtre PromQL correspondant à une
        MonitoringTarget.

        Priorité :
            1. prometheus_job
            2. endpoint

        Exemple :

            prometheus_job = "node"
            endpoint = "host.docker.internal:9100"

        donne :

            job="node",
            instance="host.docker.internal:9100"
        """

        filters = []

        if target.prometheus_job:
            job = self.escape_promql_value(
                target.prometheus_job
            )

            filters.append(
                f'job="{job}"'
            )

        if target.endpoint:
            endpoint = self.escape_promql_value(
                target.endpoint
            )

            filters.append(
                f'instance="{endpoint}"'
            )

        return ", ".join(filters)

    # =========================================================
    # CONSTRUCTION DE LA REQUÊTE PROMQL
    # =========================================================

    def build_query(self, metric, target):
        """
        Construit la requête PromQL complète pour une
        métrique et une cible données.
        """

        normalized_metric = self.normalize_metric(
            metric
        )

        if not normalized_metric:
            raise ValueError(
                f"Métrique non supportée : {metric}"
            )

        target_filter = self.build_target_filter(
            target
        )

        # -----------------------------------------------------
        # CPU
        # -----------------------------------------------------

        if normalized_metric == "cpu":

            if target_filter:
                cpu_selector = (
                    f'mode="idle", {target_filter}'
                )
            else:
                cpu_selector = 'mode="idle"'

            return (
                '100 - ('
                'avg by (instance) '
                f'(rate(node_cpu_seconds_total'
                f'{{{cpu_selector}}}[5m])) '
                '* 100)'
            )

        # -----------------------------------------------------
        # MÉMOIRE
        # -----------------------------------------------------

        if normalized_metric == "memory":

            selector = (
                f"{{{target_filter}}}"
                if target_filter
                else ""
            )

            return (
                '(1 - ('
                f'node_memory_MemAvailable_bytes'
                f'{selector}'
                ' / '
                f'node_memory_MemTotal_bytes'
                f'{selector}'
                ')) * 100'
            )

        # -----------------------------------------------------
        # STOCKAGE
        # -----------------------------------------------------

        if normalized_metric == "storage":

            if target_filter:
                selector = (
                    f'{target_filter}, '
                    'fstype!~"tmpfs|overlay|squashfs"'
                )
            else:
                selector = (
                    'fstype!~"tmpfs|overlay|squashfs"'
                )

            return (
                '(1 - ('
                'node_filesystem_avail_bytes'
                f'{{{selector}}}'
                ' / '
                'node_filesystem_size_bytes'
                f'{{{selector}}}'
                ')) * 100'
            )

        raise ValueError(
            f"Métrique non supportée : {metric}"
        )

    # =========================================================
    # COMPARAISON
    # =========================================================

    def compare(self, value, condition, threshold):
        """
        Compare une valeur avec un seuil.

        Opérateurs autorisés :
            >
            <
            >=
            <=
            ==
        """

        if value is None:
            return False

        try:
            value = float(value)
            threshold = float(threshold)

        except (TypeError, ValueError):
            return False

        condition = str(condition).strip()

        if condition == ">":
            return value > threshold

        if condition == "<":
            return value < threshold

        if condition == ">=":
            return value >= threshold

        if condition == "<=":
            return value <= threshold

        if condition == "==":
            return value == threshold

        return False

    # =========================================================
    # REQUÊTE PROMETHEUS
    # =========================================================

    def query_metric(self, metric, target):
        """
        Exécute la requête PromQL correspondant à une
        métrique et à une cible précise.
        """

        query = self.build_query(
            metric=metric,
            target=target,
        )

        data = self.prometheus.query(
            query
        )

        if not data:
            return []

        if not isinstance(data, dict):
            return []

        return data.get(
            "result",
            []
        )

    # =========================================================
    # EXTRACTION DES VALEURS
    # =========================================================

    def extract_values(self, results):
        """
        Transforme les résultats Prometheus en liste
        de valeurs exploitables.
        """

        values = []

        if not isinstance(results, list):
            return values

        for item in results:

            if not isinstance(item, dict):
                continue

            value_data = item.get(
                "value"
            )

            if not value_data:
                continue

            if len(value_data) < 2:
                continue

            try:
                value = float(
                    value_data[1]
                )

            except (TypeError, ValueError):
                continue

            labels = item.get(
                "metric",
                {}
            )

            if not isinstance(labels, dict):
                labels = {}

            values.append(
                {
                    "value": value,
                    "instance": labels.get(
                        "instance",
                        "unknown",
                    ),
                    "job": labels.get(
                        "job",
                        "",
                    ),
                    "labels": labels,
                }
            )

        return values

    # =========================================================
    # MESSAGE
    # =========================================================

    def build_message(
        self,
        rule,
        value,
        instance=None,
    ):
        """
        Construit le message de l'alerte.
        """

        metric = self.normalize_metric(
            rule.metric
        )

        metric_labels = {
            "cpu": "CPU",
            "memory": "Mémoire",
            "storage": "Stockage",
        }

        metric_name = metric_labels.get(
            metric,
            rule.metric,
        )

        message = (
            f"{metric_name} : "
            f"{value:.2f}% "
            f"{rule.condition} "
            f"{rule.threshold:.2f}%"
        )

        if instance and instance != "unknown":
            message += (
                f" — Instance : {instance}"
            )

        return message

    # =========================================================
    # ALERTE ACTIVE
    # =========================================================

    def get_active_alert(self, rule):
        """
        Retourne l'alerte actuellement active
        pour une règle.
        """

        return (
            AlertHistory.objects
            .filter(
                rule=rule,
                status=AlertHistory.Status.FIRING,
                resolved_at__isnull=True,
            )
            .order_by("-triggered_at")
            .first()
        )

    # =========================================================
    # DÉCLENCHEMENT
    # =========================================================

    def trigger_alert(
        self,
        rule,
        value,
        instance=None,
    ):
        """
        Déclenche une nouvelle alerte si aucune alerte
        active n'existe déjà pour cette règle.
        """

        active_alert = self.get_active_alert(
            rule
        )

        message = self.build_message(
            rule=rule,
            value=value,
            instance=instance,
        )

        # -----------------------------------------------------
        # Déjà active
        # -----------------------------------------------------

        if active_alert:

            # On met à jour la dernière valeur connue.
            active_alert.value = value
            active_alert.message = message

            active_alert.save(
                update_fields=[
                    "value",
                    "message",
                ]
            )

            return {
                "action": "already_firing",
                "created": False,
                "history": active_alert,
                "message": message,
            }

        # -----------------------------------------------------
        # Nouvelle alerte
        # -----------------------------------------------------

        history = AlertHistory.objects.create(
            rule=rule,
            status=AlertHistory.Status.FIRING,
            value=value,
            message=message,
        )

        return {
            "action": "triggered",
            "created": True,
            "history": history,
            "message": message,
        }

    # =========================================================
    # RÉSOLUTION
    # =========================================================

    def resolve_alert(
        self,
        rule,
        value=None,
        instance=None,
    ):
        """
        Résout l'alerte active associée à une règle.
        """

        active_alert = self.get_active_alert(
            rule
        )

        if not active_alert:
            return {
                "action": "no_active_alert",
                "resolved": False,
                "history": None,
            }

        active_alert.status = (
            AlertHistory.Status.RESOLVED
        )

        active_alert.resolved_at = (
            timezone.now()
        )

        if value is not None:
            active_alert.value = value

            active_alert.message = (
                f"Alerte résolue. "
                f"Valeur actuelle : "
                f"{value:.2f}%"
            )

            if instance and instance != "unknown":
                active_alert.message += (
                    f" — Instance : {instance}"
                )

        active_alert.save(
            update_fields=[
                "status",
                "resolved_at",
                "value",
                "message",
            ]
        )

        return {
            "action": "resolved",
            "resolved": True,
            "history": active_alert,
        }

    # =========================================================
    # ÉVALUATION D'UNE RÈGLE
    # =========================================================

    def evaluate_rule(self, rule):
        """
        Évalue une règle contre SA cible.

        Exemple :

            rule.target = serveur-01

        La requête Prometheus sera filtrée pour serveur-01.
        """

        # -----------------------------------------------------
        # Règle désactivée
        # -----------------------------------------------------

        if not rule.enabled:

            return {
                "rule_id": rule.id,
                "rule": rule.name,
                "target": rule.target.name,
                "enabled": False,
                "status": "disabled",
                "results": [],
            }

        # -----------------------------------------------------
        # Vérification de la métrique
        # -----------------------------------------------------

        metric = self.normalize_metric(
            rule.metric
        )

        if not metric:

            return {
                "rule_id": rule.id,
                "rule": rule.name,
                "target": rule.target.name,
                "enabled": True,
                "status": "error",
                "error": (
                    f"Métrique non supportée : "
                    f"{rule.metric}"
                ),
                "results": [],
            }

        # -----------------------------------------------------
        # Vérification de la cible
        # -----------------------------------------------------

        target = rule.target

        if not target:

            return {
                "rule_id": rule.id,
                "rule": rule.name,
                "enabled": True,
                "status": "error",
                "error": (
                    "Aucune cible associée "
                    "à cette règle."
                ),
                "results": [],
            }

        # -----------------------------------------------------
        # Vérification du filtre
        # -----------------------------------------------------

        target_filter = self.build_target_filter(
            target
        )

        if not target_filter:

            return {
                "rule_id": rule.id,
                "rule": rule.name,
                "target": target.name,
                "enabled": True,
                "status": "error",
                "error": (
                    "La cible ne possède ni "
                    "prometheus_job ni endpoint."
                ),
                "results": [],
            }

        # -----------------------------------------------------
        # Requête Prometheus
        # -----------------------------------------------------

        try:

            prometheus_results = (
                self.query_metric(
                    metric=rule.metric,
                    target=target,
                )
            )

        except Exception as exc:

            return {
                "rule_id": rule.id,
                "rule": rule.name,
                "target": target.name,
                "metric": metric,
                "enabled": True,
                "status": "error",
                "error": str(exc),
                "results": [],
            }

        # -----------------------------------------------------
        # Extraction
        # -----------------------------------------------------

        values = self.extract_values(
            prometheus_results
        )

        # -----------------------------------------------------
        # Pas de données
        # -----------------------------------------------------

        if not values:

            return {
                "rule_id": rule.id,
                "rule": rule.name,
                "target": target.name,
                "metric": metric,
                "enabled": True,
                "status": "no_data",
                "results": [],
            }

        # -----------------------------------------------------
        # Évaluation
        # -----------------------------------------------------

        results = []

        for item in values:

            value = item["value"]

            instance = item[
                "instance"
            ]

            triggered = self.compare(
                value=value,
                condition=rule.condition,
                threshold=rule.threshold,
            )

            # -------------------------------------------------
            # ALERTE
            # -------------------------------------------------

            if triggered:

                alert_result = (
                    self.trigger_alert(
                        rule=rule,
                        value=value,
                        instance=instance,
                    )
                )

                results.append(
                    {
                        "instance": instance,
                        "value": value,
                        "triggered": True,
                        "action": (
                            alert_result[
                                "action"
                            ]
                        ),
                        "message": (
                            alert_result[
                                "message"
                            ]
                        ),
                    }
                )

            # -------------------------------------------------
            # NORMAL
            # -------------------------------------------------

            else:

                resolution_result = (
                    self.resolve_alert(
                        rule=rule,
                        value=value,
                        instance=instance,
                    )
                )

                results.append(
                    {
                        "instance": instance,
                        "value": value,
                        "triggered": False,
                        "action": (
                            resolution_result[
                                "action"
                            ]
                        ),
                    }
                )

        return {
            "rule_id": rule.id,
            "rule": rule.name,
            "target": target.name,
            "target_type": target.target_type,
            "metric": metric,
            "enabled": True,
            "status": "evaluated",
            "results": results,
        }

    # =========================================================
    # ÉVALUATION DE TOUTES LES RÈGLES
    # =========================================================

    def evaluate_all(self):
        """
        Évalue toutes les règles activées.
        """

        rules = (
            AlertRule.objects
            .select_related("target")
            .filter(enabled=True)
            .order_by("id")
        )

        results = []

        for rule in rules:

            result = self.evaluate_rule(
                rule
            )

            results.append(result)

        return {
            "total_rules": len(results),
            "results": results,
        }


# =============================================================
# FONCTION UTILITAIRE
# =============================================================

def evaluate_alerts():
    """
    Évalue toutes les règles d'alerte.

    Cette fonction pourra être appelée depuis :
        - une vue Django ;
        - une commande management ;
        - Celery ;
        - un scheduler.
    """

    service = AlertService()

    return service.evaluate_all()