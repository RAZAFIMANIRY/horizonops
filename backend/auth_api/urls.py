from django.urls import path

from .views import (
    login_view,
    logout_view,
    me_view,
    users_view,
    user_detail_view,
)


urlpatterns = [

    # ========================================================
    # AUTHENTIFICATION
    # ========================================================

    path(
        "login/",
        login_view,
        name="login",
    ),

    path(
        "logout/",
        logout_view,
        name="logout",
    ),

    path(
        "me/",
        me_view,
        name="me",
    ),

    # ========================================================
    # GESTION DES UTILISATEURS
    # ========================================================

    path(
        "users/",
        users_view,
        name="users",
    ),

    path(
        "users/<int:user_id>/",
        user_detail_view,
        name="user-detail",
    ),
]