import time
from datetime import timedelta

from django.utils import timezone


from .services import PrometheusService

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import (
    MonitoringTarget,
    AlertRule,
    AlertHistory,
)

from .serializers import (
    MonitoringTargetSerializer,
    AlertRuleSerializer,
    AlertHistorySerializer,
)

from .services import PrometheusService
from .alert_service import AlertService


# =========================================================
# PROMETHEUS - OVERVIEW
# =========================================================

class PrometheusOverviewAPIView(APIView):

    def get(self, request):
        try:
            data = PrometheusService().get_overview()

            return Response(data)

        except Exception as e:
            return Response(
                {
                    "prometheus": {
                        "available": False
                    },
                    "proxmox": {
                        "available": False
                    },
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - CPU
# =========================================================

class PrometheusCPUMetricsAPIView(APIView):

    def get(self, request):
        try:
            data = PrometheusService().get_cpu_metrics()

            return Response(data)

        except Exception as e:
            return Response(
                {
                    "available": False,
                    "result": [],
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - MEMORY
# =========================================================

class PrometheusMemoryMetricsAPIView(APIView):

    def get(self, request):
        try:
            data = PrometheusService().get_memory_metrics()

            return Response(data)

        except Exception as e:
            return Response(
                {
                    "available": False,
                    "usage": [],
                    "size": [],
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - STORAGE
# =========================================================

class PrometheusStorageMetricsAPIView(APIView):

    def get(self, request):
        try:
            data = PrometheusService().get_storage_metrics()

            return Response(data)

        except Exception as e:
            return Response(
                {
                    "available": False,
                    "size": [],
                    "usage": [],
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - NETWORK
# =========================================================

class PrometheusNetworkMetricsAPIView(APIView):

    def get(self, request):
        try:
            data = PrometheusService().get_network_metrics()

            return Response(data)

        except Exception as e:
            return Response(
                {
                    "available": False,
                    "receive": [],
                    "transmit": [],
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - CPU HISTORY
# =========================================================



class PrometheusCPUHistoryAPIView(APIView):
    """
    Retourne l'historique CPU du serveur Proxmox
    sur la dernière heure.
    """

    def get(self, request):

        prometheus = PrometheusService()

        end = timezone.now()

        start = (
            end - timedelta(hours=1)
        )

        try:

            data = prometheus.get_cpu_history(
                start=start.timestamp(),
                end=end.timestamp(),
                step="15s",
            )

            return Response(data)

        except Exception as exc:

            return Response(
                {
                    "error": str(exc),
                    "resultType": "matrix",
                    "result": [],
                },
                status=500,
            )


class PrometheusMemoryHistoryAPIView(APIView):
    """
    Retourne l'historique RAM du serveur Proxmox
    sur la dernière heure.
    """

    def get(self, request):

        prometheus = PrometheusService()

        end = timezone.now()

        start = (
            end - timedelta(hours=1)
        )

        try:

            data = prometheus.get_memory_history(
                start=start.timestamp(),
                end=end.timestamp(),
                step="15s",
            )

            return Response(data)

        except Exception as exc:

            return Response(
                {
                    "error": str(exc),
                    "resultType": "matrix",
                    "result": [],
                },
                status=500,
            )


# =========================================================
# PROMETHEUS - QUERY
# =========================================================

class PrometheusQueryAPIView(APIView):

    def get(self, request):

        query = request.query_params.get(
            "query"
        )

        if not query:
            return Response(
                {
                    "success": False,
                    "error": (
                        "Le paramètre 'query' "
                        "est obligatoire."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = PrometheusService().query(
                query
            )

            return Response(
                {
                    "success": True,
                    "data": data,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - QUERY RANGE
# =========================================================

class PrometheusQueryRangeAPIView(APIView):

    def get(self, request):

        query = request.query_params.get(
            "query"
        )

        start = request.query_params.get(
            "start"
        )

        end = request.query_params.get(
            "end"
        )

        step = request.query_params.get(
            "step",
            "15s",
        )

        if not query:
            return Response(
                {
                    "success": False,
                    "error": (
                        "Le paramètre 'query' "
                        "est obligatoire."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not start or not end:
            return Response(
                {
                    "success": False,
                    "error": (
                        "Les paramètres 'start' "
                        "et 'end' sont obligatoires."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = PrometheusService().query_range(
                query=query,
                start=start,
                end=end,
                step=step,
            )

            return Response(
                {
                    "success": True,
                    "data": data,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - TARGETS
# =========================================================

class PrometheusTargetsAPIView(APIView):

    def get(self, request):

        try:
            data = PrometheusService().get_targets()

            return Response(
                {
                    "success": True,
                    "data": data,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - ALERTS
# =========================================================

class PrometheusAlertsAPIView(APIView):

    def get(self, request):

        try:
            data = PrometheusService().get_alerts()

            return Response(
                {
                    "success": True,
                    "data": data,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# PROMETHEUS - RULES
# =========================================================

class PrometheusRulesAPIView(APIView):

    def get(self, request):

        try:
            data = PrometheusService().get_rules()

            return Response(
                {
                    "success": True,
                    "data": data,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =========================================================
# MONITORING TARGETS - LIST / CREATE
# =========================================================

class MonitoringTargetListCreateAPIView(APIView):

    def get(self, request):

        targets = (
            MonitoringTarget.objects
            .all()
            .order_by("name")
        )

        serializer = MonitoringTargetSerializer(
            targets,
            many=True,
        )

        return Response(
            {
                "success": True,
                "targets": serializer.data,
            }
        )

    def post(self, request):

        serializer = MonitoringTargetSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        target = serializer.save()

        return Response(
            {
                "success": True,
                "target": MonitoringTargetSerializer(
                    target
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


# =========================================================
# MONITORING TARGET - DETAIL
# =========================================================

class MonitoringTargetDetailAPIView(APIView):

    def get_object(self, pk):
        return MonitoringTarget.objects.get(
            pk=pk
        )

    def get(self, request, pk):

        try:
            target = self.get_object(pk)

        except MonitoringTarget.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Cible introuvable.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MonitoringTargetSerializer(
            target
        )

        return Response(
            {
                "success": True,
                "target": serializer.data,
            }
        )

    def put(self, request, pk):

        try:
            target = self.get_object(pk)

        except MonitoringTarget.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Cible introuvable.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MonitoringTargetSerializer(
            target,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            {
                "success": True,
                "target": serializer.data,
            }
        )

    def delete(self, request, pk):

        try:
            target = self.get_object(pk)

        except MonitoringTarget.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Cible introuvable.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        target.delete()

        return Response(
            {
                "success": True,
                "message": "Cible supprimée.",
            }
        )


# =========================================================
# ALERT RULES - LIST / CREATE
# =========================================================

class AlertRuleListCreateAPIView(APIView):

    def get(self, request):

        rules = (
            AlertRule.objects
            .select_related("target")
            .all()
            .order_by("name")
        )

        serializer = AlertRuleSerializer(
            rules,
            many=True,
        )

        return Response(
            {
                "success": True,
                "rules": serializer.data,
            }
        )

    def post(self, request):

        serializer = AlertRuleSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        rule = serializer.save()

        return Response(
            {
                "success": True,
                "rule": AlertRuleSerializer(
                    rule
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


# =========================================================
# ALERT RULE - DETAIL
# =========================================================

class AlertRuleDetailAPIView(APIView):

    def get(self, request, pk):

        try:
            rule = (
                AlertRule.objects
                .select_related("target")
                .get(pk=pk)
            )

        except AlertRule.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Règle introuvable.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AlertRuleSerializer(
            rule
        )

        return Response(
            {
                "success": True,
                "rule": serializer.data,
            }
        )

    def put(self, request, pk):

        try:
            rule = AlertRule.objects.get(
                pk=pk
            )

        except AlertRule.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Règle introuvable.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AlertRuleSerializer(
            rule,
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            {
                "success": True,
                "rule": serializer.data,
            }
        )

    def delete(self, request, pk):

        try:
            rule = AlertRule.objects.get(
                pk=pk
            )

        except AlertRule.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Règle introuvable.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        rule.delete()

        return Response(
            {
                "success": True,
                "message": "Règle supprimée.",
            }
        )


# =========================================================
# ALERT HISTORY
# =========================================================

class AlertHistoryListAPIView(APIView):

    def get(self, request):

        history = (
            AlertHistory.objects
            .select_related(
                "rule",
                "rule__target",
            )
            .all()
            .order_by("-triggered_at")
        )

        serializer = AlertHistorySerializer(
            history,
            many=True,
        )

        return Response(
            {
                "success": True,
                "history": serializer.data,
            }
        )


# =========================================================
# ACTIVE ALERTS
# =========================================================

class ActiveAlertsAPIView(APIView):

    def get(self, request):

        alerts = (
            AlertHistory.objects
            .select_related(
                "rule",
                "rule__target",
            )
            .filter(
                status=AlertHistory.Status.FIRING,
                resolved_at__isnull=True,
            )
            .order_by("-triggered_at")
        )

        serializer = AlertHistorySerializer(
            alerts,
            many=True,
        )

        return Response(
            {
                "success": True,
                "alerts": serializer.data,
                "count": alerts.count(),
            }
        )


# =========================================================
# ALERT EVALUATION
# =========================================================

class AlertEvaluationAPIView(APIView):

    def get(self, request):
        """
        Évalue toutes les règles d'alerte actives.

        GET est pratique pour les tests depuis le navigateur.
        """

        try:
            result = AlertService().evaluate_all()

            return Response(
                {
                    "success": True,
                    **result,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def post(self, request):
        """
        Évalue toutes les règles d'alerte actives.
        """

        try:
            result = AlertService().evaluate_all()

            return Response(
                {
                    "success": True,
                    **result,
                }
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )