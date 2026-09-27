from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Autorise uniquement les administrateurs HorizonOps.
    """

    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Superutilisateur Django
        if user.is_superuser:
            return True

        # Administrateur HorizonOps
        role = str(getattr(user, "role", "")).upper()

        return role == "ADMIN"


class IsAuthenticatedAndReadOnly(BasePermission):
    """
    Utilisateur connecté :
    - GET
    - HEAD
    - OPTIONS
    uniquement.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        return request.method in [
            "GET",
            "HEAD",
            "OPTIONS",
        ]