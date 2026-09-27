from django.urls import path

from .views import (
    VMListAPIView,
    VMDetailAPIView,
    VMActionAPIView,
    VMDeleteAPIView,
    ContainerListAPIView,
    ContainerActionAPIView,
    VMCreateAPIView,
    ISOListAPIView,
    VMSnapshotListCreateAPIView,
    VMSnapshotDeleteAPIView,
    VMSnapshotRollbackAPIView,
)


urlpatterns = [
    path(
        "",
        VMListAPIView.as_view(),
        name="vm-list",
    ),

    path(
        "create/",
        VMCreateAPIView.as_view(),
        name="vm-create",
    ),

    path(
        "isos/",
        ISOListAPIView.as_view(),
        name="iso-list",
    ),

    path(
        "containers/",
        ContainerListAPIView.as_view(),
        name="container-list",
    ),

    path(
        "containers/<int:vmid>/<str:action>/",
        ContainerActionAPIView.as_view(),
        name="container-action",
    ),

    # -------------------------
    # SNAPSHOTS VM
    # -------------------------

    path(
        "<int:vmid>/snapshots/",
        VMSnapshotListCreateAPIView.as_view(),
        name="vm-snapshot-list-create",
    ),

    path(
        "<int:vmid>/snapshots/<str:snapname>/delete/",
        VMSnapshotDeleteAPIView.as_view(),
        name="vm-snapshot-delete",
    ),

    path(
        "<int:vmid>/snapshots/<str:snapname>/rollback/",
        VMSnapshotRollbackAPIView.as_view(),
        name="vm-snapshot-rollback",
    ),

    # -------------------------
    # VM
    # -------------------------

    path(
        "<int:vmid>/delete/",
        VMDeleteAPIView.as_view(),
        name="vm-delete",
    ),

    path(
        "<int:vmid>/<str:action>/",
        VMActionAPIView.as_view(),
        name="vm-action",
    ),

    path(
        "<int:vmid>/",
        VMDetailAPIView.as_view(),
        name="vm-detail",
    ),
]