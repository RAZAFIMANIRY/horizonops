from rest_framework import serializers
from .models import ManagedResource


class VMSerializer(serializers.Serializer):
    vmid = serializers.IntegerField()
    name = serializers.CharField(required=False, allow_null=True)
    status = serializers.CharField(required=False)
    node = serializers.CharField(required=False)
    cpu = serializers.FloatField(required=False)
    cpus = serializers.IntegerField(required=False)
    mem = serializers.IntegerField(required=False)
    maxmem = serializers.IntegerField(required=False)
    disk = serializers.IntegerField(required=False)
    maxdisk = serializers.IntegerField(required=False)
    uptime = serializers.IntegerField(required=False)


class ContainerSerializer(serializers.Serializer):
    vmid = serializers.IntegerField()
    hostname = serializers.CharField(required=False, allow_null=True)
    status = serializers.CharField(required=False)
    node = serializers.CharField(required=False)
    cpus = serializers.IntegerField(required=False)
    mem = serializers.IntegerField(required=False)
    maxmem = serializers.IntegerField(required=False)
    disk = serializers.IntegerField(required=False)
    maxdisk = serializers.IntegerField(required=False)
    uptime = serializers.IntegerField(required=False)




class ManagedResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManagedResource
        fields = [
            "id",
            "vmid",
            "name",
            "resource_type",
            "node",
            "cpu_cores",
            "memory_mb",
            "disk_gb",
            "operating_system",
            "ip_address",
            "power_state",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]