from rest_framework import serializers

from .models import Network, VLAN, NetworkInterface


class NetworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Network
        fields = [
            "id",
            "name",
            "network_type",
            "bridge_name",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class VLANSerializer(serializers.ModelSerializer):
    class Meta:
        model = VLAN
        fields = [
            "id",
            "network",
            "vlan_id",
            "name",
            "description",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]

    def validate_vlan_id(self, value):
        if value < 1 or value > 4094:
            raise serializers.ValidationError(
                "Le VLAN ID doit être compris entre 1 et 4094."
            )
        return value


class NetworkInterfaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkInterface
        fields = [
            "id",
            "network",
            "resource_vmid",
            "interface_name",
            "interface_type",
            "mac_address",
            "ip_address",
            "vlan_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class OVSBridgeSerializer(serializers.Serializer):
    name = serializers.CharField()
    ports = serializers.ListField(
        child=serializers.CharField()
    )


class OVSBridgeCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=64,
        min_length=1
    )

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Le nom du bridge ne peut pas être vide."
            )

        return value


class OVSPortSerializer(serializers.Serializer):
    bridge = serializers.CharField()
    port = serializers.CharField()


class OVSPortCreateSerializer(serializers.Serializer):
    bridge = serializers.CharField(
        max_length=64,
        min_length=1
    )

    port = serializers.CharField(
        max_length=64,
        min_length=1
    )

    def validate_bridge(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Le nom du bridge est obligatoire."
            )

        return value

    def validate_port(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Le nom du port est obligatoire."
            )

        return value