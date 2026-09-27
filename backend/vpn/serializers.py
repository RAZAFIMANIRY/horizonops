from rest_framework import serializers

from .models import WireGuardTunnel, WireGuardPeer


class WireGuardTunnelSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = WireGuardTunnel
        fields = [
            "id",
            "name",
            "interface_name",
            "address",
            "listen_port",
            "network",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate_listen_port(self, value):
        if value < 1 or value > 65535:
            raise serializers.ValidationError(
                "Le port doit être compris entre 1 et 65535."
            )

        return value


class WireGuardPeerSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = WireGuardPeer
        fields = [
            "id",
            "tunnel",
            "name",
            "public_key",
            "allowed_ips",
            "endpoint",
            "persistent_keepalive",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class WireGuardActionSerializer(
    serializers.Serializer
):
    interface = serializers.CharField(
        min_length=1,
        max_length=64,
    )


class WireGuardPeerCreateSerializer(
    serializers.Serializer
):
    interface = serializers.CharField(
        min_length=1,
        max_length=64,
    )

    public_key = serializers.CharField(
        min_length=40,
        max_length=64,
    )

    allowed_ips = serializers.ListField(
        child=serializers.CharField(
            min_length=1,
            max_length=100,
        ),
        min_length=1,
    )

    endpoint = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )

    persistent_keepalive = serializers.IntegerField(
        required=False,
        min_value=0,
        max_value=65535,
    )


class WireGuardPeerDeleteSerializer(
    serializers.Serializer
):
    interface = serializers.CharField(
        min_length=1,
        max_length=64,
    )

    public_key = serializers.CharField(
        min_length=40,
        max_length=64,
    )