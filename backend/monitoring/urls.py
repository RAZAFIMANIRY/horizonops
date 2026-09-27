from django.urls import path

from .views import (
    # Prometheus
    PrometheusOverviewAPIView,
    PrometheusCPUMetricsAPIView,
    PrometheusMemoryMetricsAPIView,
    PrometheusStorageMetricsAPIView,
    PrometheusNetworkMetricsAPIView,
    PrometheusCPUHistoryAPIView,
    PrometheusMemoryHistoryAPIView,
    PrometheusQueryAPIView,
    PrometheusQueryRangeAPIView,
    PrometheusTargetsAPIView,
    PrometheusAlertsAPIView,
    PrometheusRulesAPIView,

    # Monitoring targets
    MonitoringTargetListCreateAPIView,
    MonitoringTargetDetailAPIView,

    # Alert rules
    AlertRuleListCreateAPIView,
    AlertRuleDetailAPIView,

    # Alert history
    AlertHistoryListAPIView,
    ActiveAlertsAPIView,

    # Alert evaluation
    AlertEvaluationAPIView,
)


urlpatterns = [

    # =====================================================
    # PROMETHEUS
    # =====================================================

    path(
        "prometheus/",
        PrometheusOverviewAPIView.as_view(),
        name="prometheus-overview",
    ),

    path(
        "prometheus/metrics/cpu/",
        PrometheusCPUMetricsAPIView.as_view(),
        name="prometheus-cpu",
    ),

    path(
        "prometheus/metrics/memory/",
        PrometheusMemoryMetricsAPIView.as_view(),
        name="prometheus-memory",
    ),

    path(
        "prometheus/metrics/storage/",
        PrometheusStorageMetricsAPIView.as_view(),
        name="prometheus-storage",
    ),

    path(
        "prometheus/metrics/network/",
        PrometheusNetworkMetricsAPIView.as_view(),
        name="prometheus-network",
    ),

    path(
        "prometheus/history/cpu/",
        PrometheusCPUHistoryAPIView.as_view(),
        name="prometheus-cpu-history",
    ),

    path(
        "prometheus/history/memory/",
        PrometheusMemoryHistoryAPIView.as_view(),
        name="prometheus-memory-history",
    ),

    path(
        "prometheus/query/",
        PrometheusQueryAPIView.as_view(),
        name="prometheus-query",
    ),

    path(
        "prometheus/query-range/",
        PrometheusQueryRangeAPIView.as_view(),
        name="prometheus-query-range",
    ),

    path(
        "prometheus/targets/",
        PrometheusTargetsAPIView.as_view(),
        name="prometheus-targets",
    ),

    path(
        "prometheus/alerts/",
        PrometheusAlertsAPIView.as_view(),
        name="prometheus-alerts",
    ),

    path(
        "prometheus/rules/",
        PrometheusRulesAPIView.as_view(),
        name="prometheus-rules",
    ),


    # =====================================================
    # MONITORING TARGETS
    # =====================================================

    path(
        "targets/",
        MonitoringTargetListCreateAPIView.as_view(),
        name="monitoring-target-list-create",
    ),

    path(
        "targets/<int:pk>/",
        MonitoringTargetDetailAPIView.as_view(),
        name="monitoring-target-detail",
    ),


    # =====================================================
    # ALERT RULES
    # =====================================================

    path(
        "alerts/rules/",
        AlertRuleListCreateAPIView.as_view(),
        name="alert-rule-list-create",
    ),

    path(
        "alerts/rules/<int:pk>/",
        AlertRuleDetailAPIView.as_view(),
        name="alert-rule-detail",
    ),


    # =====================================================
    # ALERT HISTORY
    # =====================================================

    path(
        "alerts/history/",
        AlertHistoryListAPIView.as_view(),
        name="alert-history-list",
    ),

    path(
        "alerts/active/",
        ActiveAlertsAPIView.as_view(),
        name="active-alerts",
    ),


    # =====================================================
    # ALERT EVALUATION
    # =====================================================

    path(
        "alerts/evaluate/",
        AlertEvaluationAPIView.as_view(),
        name="alert-evaluation",
    ),
]