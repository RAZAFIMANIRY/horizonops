from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Utilisateur de la plateforme HorizonOps.

    Deux rôles sont disponibles :
    - admin : accès complet à la plateforme
    - user  : consultation uniquement
    """

    ROLE_ADMIN = "admin"
    ROLE_USER = "user"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Administrateur"),
        (ROLE_USER, "Utilisateur standard"),
    ]

    email = models.EmailField(
        unique=True,
        blank=False,
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_USER,
    )

    date_creation = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.username

    @property
    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    @property
    def is_standard_user(self):
        return self.role == self.ROLE_USER