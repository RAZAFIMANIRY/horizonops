from django.urls import path

from .views import (
    docker_status,
    docker_containers,
    create_container,
    container_detail,
    start_container,
    stop_container,
    restart_container,
    delete_container,
)


urlpatterns = [
    path(
        "",
        docker_containers,
        name="docker-containers",
    ),

    path(
        "status/",
        docker_status,
        name="docker-status",
    ),

    path(
        "create/",
        create_container,
        name="docker-create",
    ),

    path(
        "<str:container_id>/",
        container_detail,
        name="docker-detail",
    ),

    path(
        "<str:container_id>/start/",
        start_container,
        name="docker-start",
    ),

    path(
        "<str:container_id>/stop/",
        stop_container,
        name="docker-stop",
    ),

    path(
        "<str:container_id>/restart/",
        restart_container,
        name="docker-restart",
    ),

    path(
        "<str:container_id>/delete/",
        delete_container,
        name="docker-delete",
    ),
]