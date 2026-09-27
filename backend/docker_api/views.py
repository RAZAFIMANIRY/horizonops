import docker

from docker.errors import DockerException, NotFound, APIError

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import DockerContainer
from .serializers import DockerContainerSerializer


def get_docker_client():
    """
    Crée une connexion avec Docker Engine
    via le socket Docker.
    """
    return docker.from_env()


def calculate_cpu_percent(stats):
    """
    Calcule le pourcentage d'utilisation CPU
    du conteneur Docker.
    """
    cpu_stats = stats.get("cpu_stats", {})
    previous_cpu_stats = stats.get("precpu_stats", {})

    cpu_usage = cpu_stats.get("cpu_usage", {})
    previous_cpu_usage = previous_cpu_stats.get(
        "cpu_usage",
        {}
    )

    cpu_delta = (
        cpu_usage.get("total_usage", 0)
        - previous_cpu_usage.get("total_usage", 0)
    )

    system_delta = (
        cpu_stats.get("system_cpu_usage", 0)
        - previous_cpu_stats.get("system_cpu_usage", 0)
    )

    if system_delta <= 0 or cpu_delta < 0:
        return 0.0

    online_cpus = cpu_stats.get("online_cpus")

    if not online_cpus:
        percpu_usage = cpu_usage.get(
            "percpu_usage"
        ) or []

        online_cpus = len(percpu_usage) or 1

    cpu_percent = (
        cpu_delta
        / system_delta
        * online_cpus
        * 100.0
    )

    return round(cpu_percent, 2)


def calculate_memory_percent(stats):
    """
    Calcule le pourcentage de mémoire utilisé
    par le conteneur.
    """
    memory_stats = stats.get(
        "memory_stats",
        {}
    )

    usage = memory_stats.get(
        "usage",
        0
    )

    limit = memory_stats.get(
        "limit",
        0
    )

    if limit <= 0:
        return 0.0

    return round(
        (usage / limit) * 100.0,
        2
    )


def get_container_stats(container):
    """
    Récupère les statistiques CPU et mémoire
    du conteneur.
    """
    try:
        stats = container.stats(
            stream=False
        )

        return {
            "cpu": calculate_cpu_percent(
                stats
            ),
            "memory": calculate_memory_percent(
                stats
            ),
        }

    except Exception:
        return {
            "cpu": None,
            "memory": None,
        }


def serialize_container(container):
    """
    Transforme un objet Docker Container
    en données exploitables par l'API.
    """
    attrs = container.attrs

    config = attrs.get(
        "Config",
        {}
    )

    state = attrs.get(
        "State",
        {}
    )

    host_config = attrs.get(
        "HostConfig",
        {}
    )

    network_settings = attrs.get(
        "NetworkSettings",
        {}
    )

    networks = (
        network_settings.get(
            "Networks",
            {}
        )
        or {}
    )

    ports = (
        network_settings.get(
            "Ports",
            {}
        )
        or {}
    )

    formatted_ports = []

    for container_port, bindings in ports.items():

        if bindings:

            for binding in bindings:

                host_ip = binding.get(
                    "HostIp",
                    "0.0.0.0"
                )

                host_port = binding.get(
                    "HostPort"
                )

                formatted_ports.append(
                    f"{host_ip}:{host_port}"
                    f"->{container_port}"
                )

        else:
            formatted_ports.append(
                str(container_port)
            )

    environment = config.get(
        "Env",
        []
    )

    restart_policy = (
        host_config
        .get(
            "RestartPolicy",
            {}
        )
        .get(
            "Name",
            ""
        )
    )

    return {
        "id": container.id,
        "name": container.name,
        "image": config.get(
            "Image",
            ""
        ),
        "status": container.status,
        "cpu": None,
        "memory": None,
        "networks": list(
            networks.keys()
        ),
        "restart_count": state.get(
            "RestartCount",
            0
        ),
        "ports": formatted_ports,
        "environment": environment,
        "restart_policy": restart_policy,
    }


def sync_container_to_database(container):
    """
    Synchronise un conteneur Docker avec PostgreSQL.
    """

    data = serialize_container(
        container
    )

    DockerContainer.objects.update_or_create(
        container_id=data["id"],
        defaults={
            "name": data["name"],
            "image": data["image"],
            "status": data["status"],
            "ports": data["ports"],
            "environment": data["environment"],
            "restart_policy": data[
                "restart_policy"
            ],
        },
    )


def get_container_or_404(container_id):
    """
    Récupère un conteneur Docker par son ID
    ou son nom.
    """
    try:
        client = get_docker_client()

        return client.containers.get(
            container_id
        )

    except NotFound:
        return None


@api_view(["GET"])
def docker_status(request):
    """
    Vérifie si Docker Engine est disponible.
    """
    try:
        client = get_docker_client()

        info = client.version()

        return Response(
            {
                "available": True,
                "version": info.get(
                    "Version"
                ),
                "api_version": info.get(
                    "ApiVersion"
                ),
                "os": info.get(
                    "Os"
                ),
                "architecture": info.get(
                    "Arch"
                ),
            },
            status=status.HTTP_200_OK,
        )

    except DockerException as error:
        return Response(
            {
                "available": False,
                "error": str(error),
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


@api_view(["GET"])
def docker_containers(request):
    """
    Retourne la liste de tous les conteneurs Docker
    et synchronise PostgreSQL.
    """
    try:
        client = get_docker_client()

        containers = client.containers.list(
            all=True
        )

        result = []

        for container in containers:

            data = serialize_container(
                container
            )

            if container.status == "running":

                stats = get_container_stats(
                    container
                )

                data["cpu"] = stats["cpu"]
                data["memory"] = stats["memory"]

            sync_container_to_database(
                container
            )

            result.append(data)

        return Response(
            result,
            status=status.HTTP_200_OK,
        )

    except DockerException as error:
        return Response(
            {
                "error": (
                    "Impossible de communiquer "
                    f"avec Docker : {error}"
                )
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


@api_view(["POST"])
def create_container(request):
    """
    Crée un conteneur Docker puis l'enregistre
    dans PostgreSQL.
    """

    name = request.data.get(
        "name"
    )

    image = request.data.get(
        "image"
    )

    ports = request.data.get(
        "ports"
    )

    network = request.data.get(
        "network"
    )

    command = request.data.get(
        "command"
    )

    environment = request.data.get(
        "environment"
    )

    restart_policy = request.data.get(
        "restart_policy"
    )

    if not name:
        return Response(
            {
                "error": (
                    "Le nom du conteneur "
                    "est obligatoire."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not image:
        return Response(
            {
                "error": (
                    "L'image Docker "
                    "est obligatoire."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        client = get_docker_client()

        # Préparation des ports
        port_bindings = None

        if ports:

            port_bindings = {}

            if isinstance(
                ports,
                str
            ):
                ports = [ports]

            for port in ports:

                port = str(
                    port
                ).strip()

                if not port:
                    continue

                if ":" in port:

                    host_port, container_port = (
                        port.split(
                            ":",
                            1
                        )
                    )

                    port_bindings[
                        f"{container_port}/tcp"
                    ] = int(
                        host_port
                    )

                else:

                    port_bindings[
                        f"{port}/tcp"
                    ] = None

        # Préparation de l'environnement
        environment_data = None

        if environment:

            if isinstance(
                environment,
                dict
            ):
                environment_data = environment

            elif isinstance(
                environment,
                list
            ):
                environment_data = environment

        # Préparation de la politique
        restart_policy_data = None

        if restart_policy:
            restart_policy_data = {
                "Name": restart_policy
            }

        # Création Docker
        container = client.containers.create(
            image=image,
            name=name,
            command=command or None,
            ports=port_bindings,
            network=network or None,
            environment=environment_data,
            restart_policy=restart_policy_data,
        )

        # Synchronisation PostgreSQL
        sync_container_to_database(
            container
        )

        container.reload()

        return Response(
            {
                "success": True,
                "message": (
                    "Conteneur créé "
                    "avec succès."
                ),
                "container": (
                    serialize_container(
                        container
                    )
                ),
            },
            status=status.HTTP_201_CREATED,
        )

    except NotFound as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    except APIError as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    except DockerException as error:
        return Response(
            {
                "error": str(error)
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


@api_view(["GET"])
def container_detail(request, container_id):
    """
    Retourne les informations détaillées
    d'un conteneur Docker.
    """
    container = get_container_or_404(
        container_id
    )

    if container is None:
        return Response(
            {
                "error": (
                    "Conteneur introuvable."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        container.reload()

        data = serialize_container(
            container
        )

        if container.status == "running":

            stats = get_container_stats(
                container
            )

            data["cpu"] = stats["cpu"]
            data["memory"] = stats["memory"]

        sync_container_to_database(
            container
        )

        return Response(
            data,
            status=status.HTTP_200_OK,
        )

    except DockerException as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@api_view(["POST"])
def start_container(request, container_id):
    """
    Démarre un conteneur Docker et synchronise
    son état dans PostgreSQL.
    """
    container = get_container_or_404(
        container_id
    )

    if container is None:
        return Response(
            {
                "error": (
                    "Conteneur introuvable."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        container.start()
        container.reload()

        sync_container_to_database(
            container
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Conteneur démarré."
                ),
                "container": (
                    serialize_container(
                        container
                    )
                ),
                "database_updated": True,
            },
            status=status.HTTP_200_OK,
        )

    except APIError as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    except DockerException as error:
        return Response(
            {
                "error": str(error)
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


@api_view(["POST"])
def stop_container(request, container_id):
    """
    Arrête un conteneur Docker et synchronise
    son état dans PostgreSQL.
    """
    container = get_container_or_404(
        container_id
    )

    if container is None:
        return Response(
            {
                "error": (
                    "Conteneur introuvable."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        container.stop()
        container.reload()

        sync_container_to_database(
            container
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Conteneur arrêté."
                ),
                "container": (
                    serialize_container(
                        container
                    )
                ),
                "database_updated": True,
            },
            status=status.HTTP_200_OK,
        )

    except APIError as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    except DockerException as error:
        return Response(
            {
                "error": str(error)
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


@api_view(["POST"])
def restart_container(request, container_id):
    """
    Redémarre un conteneur Docker et synchronise
    son état dans PostgreSQL.
    """
    container = get_container_or_404(
        container_id
    )

    if container is None:
        return Response(
            {
                "error": (
                    "Conteneur introuvable."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        container.restart()
        container.reload()

        sync_container_to_database(
            container
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Conteneur redémarré."
                ),
                "container": (
                    serialize_container(
                        container
                    )
                ),
                "database_updated": True,
            },
            status=status.HTTP_200_OK,
        )

    except APIError as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    except DockerException as error:
        return Response(
            {
                "error": str(error)
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


@api_view(["DELETE"])
def delete_container(request, container_id):
    """
    Supprime un conteneur Docker puis son
    enregistrement dans PostgreSQL.
    """
    container = get_container_or_404(
        container_id
    )

    if container is None:
        return Response(
            {
                "error": (
                    "Conteneur introuvable."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        docker_container_id = container.id

        container.remove(
            force=True
        )

        database_deleted = (
            DockerContainer.objects.filter(
                container_id=docker_container_id
            ).delete()[0]
            > 0
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Conteneur supprimé "
                    "avec succès."
                ),
                "container_id": (
                    docker_container_id
                ),
                "database_deleted": (
                    database_deleted
                ),
            },
            status=status.HTTP_200_OK,
        )

    except APIError as error:
        return Response(
            {
                "error": str(error)
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    except DockerException as error:
        return Response(
            {
                "error": str(error)
            },
            status=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )