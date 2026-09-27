from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Network
from .services import OVSService
from .serializers import (
    NetworkSerializer,
    OVSBridgeCreateSerializer,
    OVSBridgeSerializer,
    OVSPortCreateSerializer,
    OVSPortSerializer,
)


class OVSOverviewAPIView(APIView):
    """
    Retourne l'état général d'Open vSwitch
    ainsi que les bridges présents dans PostgreSQL.
    """

    def get(self, request):
        try:
            ovs = OVSService()

            bridges = ovs.get_bridges()

            result = []

            for bridge in bridges:
                ports = ovs.get_ports(bridge)

                data = {
                    "name": bridge,
                    "ports": ports,
                }

                serializer = OVSBridgeSerializer(
                    data
                )

                result.append(serializer.data)

                ovs.sync_bridge_to_database(
                    bridge
                )

            return Response(
                {
                    "version": ovs.get_version(),
                    "bridges": result,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class OVSBridgeListAPIView(APIView):
    """
    Retourne la liste des bridges OVS
    et synchronise PostgreSQL.
    """

    def get(self, request):
        try:
            ovs = OVSService()

            bridges = ovs.get_bridges()

            result = []

            for bridge in bridges:
                ovs.sync_bridge_to_database(
                    bridge
                )

                result.append({
                    "name": bridge,
                    "ports": ovs.get_ports(
                        bridge
                    ),
                })

            serializer = OVSBridgeSerializer(
                result,
                many=True,
            )

            return Response(
                serializer.data,
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class OVSBridgeCreateAPIView(APIView):
    """
    Crée un bridge OVS et son enregistrement
    dans PostgreSQL.
    """

    def post(self, request):
        serializer = OVSBridgeCreateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        bridge = serializer.validated_data["name"]

        try:
            ovs = OVSService()

            ovs.create_bridge(
                bridge
            )

            network = Network.objects.get(
                bridge_name=bridge
            )

            return Response(
                {
                    "success": True,
                    "message": (
                        f"Bridge {bridge} créé."
                    ),
                    "network": NetworkSerializer(
                        network
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class OVSBridgeDeleteAPIView(APIView):
    """
    Supprime un bridge OVS et son réseau
    associé dans PostgreSQL.
    """

    def delete(self, request, bridge):
        try:
            ovs = OVSService()

            ovs.delete_bridge(
                bridge
            )

            return Response(
                {
                    "success": True,
                    "message": (
                        f"Bridge {bridge} supprimé."
                    ),
                    "database_updated": True,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class OVSBridgePortsAPIView(APIView):
    """
    Retourne les ports d'un bridge OVS.
    """

    def get(self, request, bridge):
        try:
            ovs = OVSService()

            bridges = ovs.get_bridges()

            if bridge not in bridges:
                return Response(
                    {
                        "error": (
                            f"Bridge {bridge} "
                            "introuvable."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            ports = ovs.get_ports(
                bridge
            )

            serializer = OVSPortSerializer(
                [
                    {
                        "bridge": bridge,
                        "port": port,
                    }
                    for port in ports
                ],
                many=True,
            )

            return Response(
                serializer.data,
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class OVSPortCreateAPIView(APIView):
    """
    Ajoute un port à un bridge OVS.
    """

    def post(self, request):
        serializer = OVSPortCreateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        bridge = serializer.validated_data[
            "bridge"
        ]

        port = serializer.validated_data[
            "port"
        ]

        try:
            ovs = OVSService()

            if bridge not in ovs.get_bridges():
                return Response(
                    {
                        "error": (
                            f"Bridge {bridge} "
                            "introuvable."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            ovs.add_port(
                bridge,
                port,
            )

            return Response(
                {
                    "success": True,
                    "message": (
                        f"Port {port} ajouté "
                        f"au bridge {bridge}."
                    ),
                    "bridge": bridge,
                    "port": port,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class OVSPortDeleteAPIView(APIView):
    """
    Supprime un port d'un bridge OVS.
    """

    def delete(self, request, bridge, port):
        try:
            ovs = OVSService()

            if bridge not in ovs.get_bridges():
                return Response(
                    {
                        "error": (
                            f"Bridge {bridge} "
                            "introuvable."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            ovs.delete_port(
                bridge,
                port,
            )

            return Response(
                {
                    "success": True,
                    "message": (
                        f"Port {port} supprimé "
                        f"du bridge {bridge}."
                    ),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )