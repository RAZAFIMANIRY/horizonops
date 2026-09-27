from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .services import WireGuardService
from .serializers import (
    WireGuardTunnelSerializer,
    WireGuardPeerSerializer,
    WireGuardActionSerializer,
    WireGuardPeerCreateSerializer,
    WireGuardPeerDeleteSerializer,
)


class WireGuardOverviewAPIView(APIView):
    """
    Retourne l'ensemble des interfaces WireGuard actives.
    """

    def get(self, request):
        try:
            wg = WireGuardService()

            interfaces = wg.get_all()

            return Response({
                "success": True,
                "interfaces": interfaces,
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class WireGuardInterfaceAPIView(APIView):
    """
    Retourne les informations détaillées
    d'une interface WireGuard.
    """

    def get(self, request, interface):
        try:
            wg = WireGuardService()

            data = wg.get_interface(interface)

            return Response({
                "success": True,
                "data": data,
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_404_NOT_FOUND,
            )


class WireGuardStatusAPIView(APIView):
    """
    Retourne uniquement l'état UP/DOWN
    d'une interface WireGuard.
    """

    def get(self, request, interface):
        try:
            wg = WireGuardService()

            return Response({
                "success": True,
                "data": wg.get_status(interface),
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class WireGuardDatabaseSyncAPIView(APIView):
    """
    Synchronise les interfaces WireGuard actives
    avec PostgreSQL.
    """

    def post(self, request):
        try:
            wg = WireGuardService()

            tunnels = wg.sync_all_to_database()

            serializer = WireGuardTunnelSerializer(
                tunnels,
                many=True,
            )

            return Response({
                "success": True,
                "message": (
                    "Synchronisation WireGuard "
                    "terminée."
                ),
                "tunnels": serializer.data,
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class WireGuardTunnelListAPIView(APIView):
    """
    Retourne les tunnels WireGuard enregistrés
    dans PostgreSQL.
    """

    def get(self, request):
        from .models import WireGuardTunnel

        tunnels = WireGuardTunnel.objects.all().order_by(
            "name"
        )

        serializer = WireGuardTunnelSerializer(
            tunnels,
            many=True,
        )

        return Response({
            "success": True,
            "tunnels": serializer.data,
        })


class WireGuardPeerListAPIView(APIView):
    """
    Retourne les peers WireGuard enregistrés
    dans PostgreSQL.
    """

    def get(self, request):
        from .models import WireGuardPeer

        peers = WireGuardPeer.objects.select_related(
            "tunnel"
        ).all().order_by("name")

        serializer = WireGuardPeerSerializer(
            peers,
            many=True,
        )

        return Response({
            "success": True,
            "peers": serializer.data,
        })


class WireGuardUpAPIView(APIView):

    def post(self, request):
        serializer = WireGuardActionSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        interface = serializer.validated_data[
            "interface"
        ]

        try:
            wg = WireGuardService()

            output = wg.interface_up(
                interface
            )

            return Response({
                "success": True,
                "message": (
                    f"Interface {interface} activée."
                ),
                "output": output,
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class WireGuardDownAPIView(APIView):

    def post(self, request):
        serializer = WireGuardActionSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        interface = serializer.validated_data[
            "interface"
        ]

        try:
            wg = WireGuardService()

            output = wg.interface_down(
                interface
            )

            return Response({
                "success": True,
                "message": (
                    f"Interface {interface} désactivée."
                ),
                "output": output,
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class WireGuardPeerCreateAPIView(APIView):

    def post(self, request):
        serializer = WireGuardPeerCreateSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        data = serializer.validated_data

        try:
            wg = WireGuardService()

            output = wg.add_peer(
                interface=data["interface"],
                public_key=data["public_key"],
                allowed_ips=data["allowed_ips"],
                endpoint=data.get("endpoint"),
                persistent_keepalive=data.get(
                    "persistent_keepalive"
                ),
            )

            return Response(
                {
                    "success": True,
                    "message": "Peer ajouté.",
                    "output": output,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class WireGuardPeerDeleteAPIView(APIView):

    def delete(self, request):
        serializer = WireGuardPeerDeleteSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        data = serializer.validated_data

        try:
            wg = WireGuardService()

            output = wg.remove_peer(
                interface=data["interface"],
                public_key=data["public_key"],
            )

            return Response({
                "success": True,
                "message": "Peer supprimé.",
                "output": output,
            })

        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )