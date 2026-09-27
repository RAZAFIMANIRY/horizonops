from django.contrib.auth import authenticate, login, logout, get_user_model
from django.middleware.csrf import get_token

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .permissions import IsAdmin


User = get_user_model()


# ============================================================
# AUTHENTIFICATION
# ============================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authentifie un utilisateur et ouvre une session Django.

    Retourne également le rôle de l'utilisateur afin que
    l'interface React puisse adapter l'affichage.
    """

    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {
                "success": False,
                "message": "Nom d'utilisateur et mot de passe requis.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return Response(
            {
                "success": False,
                "message": "Nom d'utilisateur ou mot de passe incorrect.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {
                "success": False,
                "message": "Ce compte est désactivé.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    login(request, user)

    # Force la création du cookie CSRF.
    get_token(request)

    return Response(
        {
            "success": True,
            "message": "Authentification réussie.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": getattr(user, "role", "user"),
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "is_active": user.is_active,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Ferme la session Django de l'utilisateur.
    """

    logout(request)

    return Response(
        {
            "success": True,
            "message": "Déconnexion réussie.",
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    Retourne les informations de l'utilisateur actuellement connecté.
    """

    user = request.user

    return Response(
        {
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": getattr(user, "role", "user"),
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "is_active": user.is_active,
            },
        },
        status=status.HTTP_200_OK,
    )


# ============================================================
# UTILISATEURS
# ============================================================

def serialize_user(user):
    """
    Convertit un utilisateur Django en données JSON.
    """

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": getattr(user, "role", "user"),
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "date_joined": user.date_joined,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsAdmin])
def users_view(request):
    """
    Gestion de la liste des utilisateurs.

    GET  : afficher tous les utilisateurs.
    POST : créer un utilisateur.

    Ces opérations sont réservées aux administrateurs.
    """

    # --------------------------------------------------------
    # GET : liste des utilisateurs
    # --------------------------------------------------------

    if request.method == "GET":

        users = User.objects.all().order_by("username")

        return Response(
            {
                "success": True,
                "users": [
                    serialize_user(user)
                    for user in users
                ],
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # POST : création d'un utilisateur
    # --------------------------------------------------------

    username = request.data.get("username")
    email = request.data.get("email", "")
    password = request.data.get("password")
    role = request.data.get("role", "user")
    is_active = request.data.get("is_active", True)

    if not username:
        return Response(
            {
                "success": False,
                "message": "Le nom d'utilisateur est requis.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not password:
        return Response(
            {
                "success": False,
                "message": "Le mot de passe est requis.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if role not in ["admin", "user"]:
        return Response(
            {
                "success": False,
                "message": "Le rôle doit être 'admin' ou 'user'.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {
                "success": False,
                "message": "Ce nom d'utilisateur existe déjà.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if email and User.objects.filter(email=email).exists():
        return Response(
            {
                "success": False,
                "message": "Cette adresse e-mail existe déjà.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
    )

    # Rôle HorizonOps
    if hasattr(user, "role"):
        user.role = role

    user.is_active = bool(is_active)

    # Synchronisation avec Django
    user.is_staff = role == "admin"

    user.save()

    return Response(
        {
            "success": True,
            "message": "Utilisateur créé avec succès.",
            "user": serialize_user(user),
        },
        status=status.HTTP_201_CREATED,
    )


# ============================================================
# UTILISATEUR INDIVIDUEL
# ============================================================

@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdmin])
def user_detail_view(request, user_id):
    """
    Gestion d'un utilisateur particulier.

    GET    : consulter
    PUT    : modifier
    PATCH  : modifier partiellement
    DELETE : supprimer

    Réservé aux administrateurs.
    """

    try:
        user = User.objects.get(pk=user_id)

    except User.DoesNotExist:
        return Response(
            {
                "success": False,
                "message": "Utilisateur introuvable.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    if request.method == "GET":

        return Response(
            {
                "success": True,
                "user": serialize_user(user),
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # DELETE
    # --------------------------------------------------------

    if request.method == "DELETE":

        # Empêcher l'admin de supprimer son propre compte
        if user.id == request.user.id:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Vous ne pouvez pas supprimer "
                        "votre propre compte."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Empêcher la suppression du dernier admin actif
        if getattr(user, "role", "user") == "admin":

            active_admins = User.objects.filter(
                role="admin",
                is_active=True,
            ).exclude(
                pk=user.id
            ).count()

            if active_admins == 0:

                return Response(
                    {
                        "success": False,
                        "message": (
                            "Impossible de supprimer le dernier "
                            "administrateur actif."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        username = user.username

        user.delete()

        return Response(
            {
                "success": True,
                "message": (
                    f"L'utilisateur '{username}' "
                    "a été supprimé."
                ),
            },
            status=status.HTTP_200_OK,
        )

    # --------------------------------------------------------
    # PUT / PATCH
    # --------------------------------------------------------

    username = request.data.get(
        "username",
        user.username,
    )

    email = request.data.get(
        "email",
        user.email,
    )

    role = request.data.get(
        "role",
        getattr(user, "role", "user"),
    )

    is_active = request.data.get(
        "is_active",
        user.is_active,
    )

    password = request.data.get("password")

    # Vérification du rôle
    if role not in ["admin", "user"]:

        return Response(
            {
                "success": False,
                "message": (
                    "Le rôle doit être 'admin' ou 'user'."
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Vérification du username
    if User.objects.filter(
        username=username
    ).exclude(
        pk=user.id
    ).exists():

        return Response(
            {
                "success": False,
                "message": (
                    "Ce nom d'utilisateur existe déjà."
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Vérification de l'e-mail
    if email and User.objects.filter(
        email=email
    ).exclude(
        pk=user.id
    ).exists():

        return Response(
            {
                "success": False,
                "message": (
                    "Cette adresse e-mail existe déjà."
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Empêcher l'admin de se désactiver lui-même
    if user.id == request.user.id and not is_active:

        return Response(
            {
                "success": False,
                "message": (
                    "Vous ne pouvez pas désactiver "
                    "votre propre compte."
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # --------------------------------------------------------
    # Protection du dernier administrateur actif
    # --------------------------------------------------------

    current_role = getattr(
        user,
        "role",
        "user",
    )

    if (
        current_role == "admin"
        and user.is_active
        and (
            role != "admin"
            or not is_active
        )
    ):

        active_admins = User.objects.filter(
            role="admin",
            is_active=True,
        ).exclude(
            pk=user.id
        ).count()

        if active_admins == 0:

            return Response(
                {
                    "success": False,
                    "message": (
                        "Impossible de supprimer ou "
                        "désactiver le dernier "
                        "administrateur actif."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    # --------------------------------------------------------
    # Mise à jour
    # --------------------------------------------------------

    user.username = username
    user.email = email
    user.is_active = is_active

    if hasattr(user, "role"):
        user.role = role

    # Synchronisation avec Django
    user.is_staff = role == "admin"

    # Modification du mot de passe
    if password:
        user.set_password(password)

    user.save()

    return Response(
        {
            "success": True,
            "message": "Utilisateur modifié avec succès.",
            "user": serialize_user(user),
        },
        status=status.HTTP_200_OK,
    )