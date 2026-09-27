from rest_framework import serializers

from .models import DockerContainer


class DockerContainerSerializer(serializers.ModelSerializer):
    class Meta:
        model = DockerContainer
        fields = [
            "id",
            "container_id",
            "name",
            "image",
            "status",
            "ports",
            "environment",
            "restart_policy",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
