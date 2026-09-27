from django.urls import path

from .views import (
    OVSOverviewAPIView,
    OVSBridgeListAPIView,
    OVSBridgeCreateAPIView,
    OVSBridgeDeleteAPIView,
    OVSBridgePortsAPIView,
    OVSPortCreateAPIView,
    OVSPortDeleteAPIView,
)


urlpatterns = [

    path(
        "ovs/",
        OVSOverviewAPIView.as_view(),
        name="ovs-overview",
    ),

    path(
        "ovs/bridges/",
        OVSBridgeListAPIView.as_view(),
        name="ovs-bridge-list",
    ),

    path(
        "ovs/bridges/create/",
        OVSBridgeCreateAPIView.as_view(),
        name="ovs-bridge-create",
    ),

    path(
        "ovs/bridges/<str:bridge>/",
        OVSBridgeDeleteAPIView.as_view(),
        name="ovs-bridge-delete",
    ),

    path(
        "ovs/bridges/<str:bridge>/ports/",
        OVSBridgePortsAPIView.as_view(),
        name="ovs-bridge-ports",
    ),

    path(
        "ovs/ports/create/",
        OVSPortCreateAPIView.as_view(),
        name="ovs-port-create",
    ),

    path(
        "ovs/bridges/<str:bridge>/ports/<str:port>/",
        OVSPortDeleteAPIView.as_view(),
        name="ovs-port-delete",
    ),
]