from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer utilisé pour l'affichage des utilisateurs.
    Le mot de passe n'est jamais retourné par l'API.
    """

    role_display = serializers.CharField(
        source="get_role_display",
        read_only=True,
    )

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "is_active",
            "date_joined",
            "date_creation",
        ]

        read_only_fields = [
            "id",
            "date_joined",
            "date_creation",
            "role_display",
        ]


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Création d'un utilisateur par un administrateur.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )

    password_confirmation = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User

        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirmation",
            "role",
            "is_active",
        ]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "Ce nom d'utilisateur existe déjà."
            )

        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Cette adresse e-mail existe déjà."
            )

        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirmation"]:
            raise serializers.ValidationError(
                {
                    "password_confirmation":
                    "Les mots de passe ne correspondent pas."
                }
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirmation")

        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Modification d'un utilisateur.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        validators=[validate_password],
        style={"input_type": "password"},
    )

    password_confirmation = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
    )

    class Meta:
        model = User

        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirmation",
            "role",
            "is_active",
        ]

    def validate_username(self, value):
        user = self.instance

        if User.objects.filter(
            username__iexact=value
        ).exclude(
            pk=user.pk
        ).exists():
            raise serializers.ValidationError(
                "Ce nom d'utilisateur existe déjà."
            )

        return value

    def validate_email(self, value):
        user = self.instance

        if User.objects.filter(
            email__iexact=value
        ).exclude(
            pk=user.pk
        ).exists():
            raise serializers.ValidationError(
                "Cette adresse e-mail existe déjà."
            )

        return value

    def validate(self, attrs):
        password = attrs.get("password")
        confirmation = attrs.get("password_confirmation")

        if password or confirmation:
            if not password or not confirmation:
                raise serializers.ValidationError(
                    {
                        "password_confirmation":
                        "Les deux champs sont nécessaires."
                    }
                )

            if password != confirmation:
                raise serializers.ValidationError(
                    {
                        "password_confirmation":
                        "Les mots de passe ne correspondent pas."
                    }
                )

        return attrs

    def update(self, instance, validated_data):
        validated_data.pop("password_confirmation", None)

        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance