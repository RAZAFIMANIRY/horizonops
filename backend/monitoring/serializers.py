from rest_framework import serializers

from .models import (
    MonitoringTarget,
    AlertRule,
    AlertHistory,
)


class MonitoringTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonitoringTarget
        fields = [
            "id",
            "name",
            "target_type",
            "endpoint",
            "prometheus_job",
            "status",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class AlertRuleSerializer(serializers.ModelSerializer):
    target_name = serializers.CharField(
        source="target.name",
        read_only=True,
    )

    target_type = serializers.CharField(
        source="target.target_type",
        read_only=True,
    )

    class Meta:
        model = AlertRule
        fields = [
            "id",
            "name",
            "target",
            "target_name",
            "target_type",
            "metric",
            "condition",
            "threshold",
            "severity",
            "enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "target_name",
            "target_type",
            "created_at",
            "updated_at",
        ]


class AlertHistorySerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(
        source="rule.name",
        read_only=True,
    )

    target_name = serializers.CharField(
        source="rule.target.name",
        read_only=True,
    )

    target_type = serializers.CharField(
        source="rule.target.target_type",
        read_only=True,
    )

    class Meta:
        model = AlertHistory
        fields = [
            "id",
            "rule",
            "rule_name",
            "target_name",
            "target_type",
            "status",
            "value",
            "message",
            "triggered_at",
            "resolved_at",
        ]
        read_only_fields = [
            "id",
            "rule_name",
            "target_name",
            "target_type",
            "triggered_at",
        ]