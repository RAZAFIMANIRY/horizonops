from django.urls import path

from .views import (
    WireGuardOverviewAPIView,
    WireGuardInterfaceAPIView,
    WireGuardStatusAPIView,
    WireGuardDatabaseSyncAPIView,
    WireGuardTunnelListAPIView,
    WireGuardPeerListAPIView,
    WireGuardUpAPIView,
    WireGuardDownAPIView,
    WireGuardPeerCreateAPIView,
    WireGuardPeerDeleteAPIView,
)


urlpatterns = [
    # État réel de WireGuard
    path(
        "wireguard/",
        WireGuardOverviewAPIView.as_view(),
        name="wireguard-overview",
    ),

    path(
        "wireguard/<str:interface>/",
        WireGuardInterfaceAPIView.as_view(),
        name="wireguard-interface",
    ),

    path(
        "wireguard/<str:interface>/status/",
        WireGuardStatusAPIView.as_view(),
        name="wireguard-status",
    ),

    # Activation / désactivation
    path(
        "wireguard/up/",
        WireGuardUpAPIView.as_view(),
        name="wireguard-up",
    ),

    path(
        "wireguard/down/",
        WireGuardDownAPIView.as_view(),
        name="wireguard-down",
    ),

    # Synchronisation avec PostgreSQL
    path(
        "wireguard/sync/",
        WireGuardDatabaseSyncAPIView.as_view(),
        name="wireguard-sync",
    ),

    # Données persistées
    path(
        "wireguard/tunnels/",
        WireGuardTunnelListAPIView.as_view(),
        name="wireguard-tunnels",
    ),

    path(
        "wireguard/peers/",
        WireGuardPeerListAPIView.as_view(),
        name="wireguard-peers",
    ),

    # Gestion des peers
    path(
        "wireguard/peers/create/",
        WireGuardPeerCreateAPIView.as_view(),
        name="wireguard-peer-create",
    ),

    path(
        "wireguard/peers/delete/",
        WireGuardPeerDeleteAPIView.as_view(),
        name="wireguard-peer-delete",
    ),
]