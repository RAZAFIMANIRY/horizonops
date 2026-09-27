import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

/* ============================================================
   FORMULAIRE INITIAL
   ============================================================ */

const emptyForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  password_confirmation: "",
  role: "user",
  is_active: true,
};

/* ============================================================
   COMPOSANT
   ============================================================ */

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  /* ==========================================================
     CSRF
     ========================================================== */

  const getCsrfToken = () => {
    const cookies = document.cookie.split(";");

    const csrfCookie = cookies.find((cookie) =>
      cookie.trim().startsWith("csrftoken=")
    );

    if (!csrfCookie) {
      return "";
    }

    return decodeURIComponent(
      csrfCookie.trim().substring("csrftoken=".length)
    );
  };

  /* ==========================================================
     HEADERS
     ========================================================== */

  const getHeaders = () => {
    const headers = {
      "Content-Type": "application/json",
    };

    const csrfToken = getCsrfToken();

    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }

    return headers;
  };

  /* ==========================================================
     NORMALISATION DU ROLE
     ========================================================== */

  const normalizeUser = (user) => {
    const role =
      String(user?.role || "user").toLowerCase() === "admin"
        ? "admin"
        : "user";

    return {
      ...user,
      role,
      is_active: Boolean(user?.is_active),
    };
  };

  /* ==========================================================
     CHARGEMENT DES UTILISATEURS
     ========================================================== */

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/auth/users/`,
        {
          method: "GET",
          credentials: "include",
          headers: getHeaders(),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.detail ||
            "Impossible de récupérer les utilisateurs."
        );
      }

      const userList = Array.isArray(data?.users)
        ? data.users
        : [];

      setUsers(userList.map(normalizeUser));
    } catch (err) {
      console.error(
        "Erreur lors du chargement des utilisateurs :",
        err
      );

      setUsers([]);

      setError(
        err.message ||
          "Erreur lors du chargement des utilisateurs."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     CHARGEMENT INITIAL
     ========================================================== */

  useEffect(() => {
    loadUsers();
  }, []);

  /* ==========================================================
     MODIFICATION DU FORMULAIRE
     ========================================================== */

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((previous) => ({
      ...previous,

      [name]:
        type === "checkbox"
          ? checked
          : name === "role"
            ? value.toLowerCase()
            : value,
    }));
  };

  /* ==========================================================
     OUVRIR MODALE CREATION
     ========================================================== */

  const openCreateModal = () => {
    setEditingUser(null);

    setForm({
      ...emptyForm,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  /* ==========================================================
     OUVRIR MODALE MODIFICATION
     ========================================================== */

  const openEditModal = (user) => {
    setEditingUser(user);

    setForm({
      username: user.username || "",
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      password: "",
      password_confirmation: "",

      role:
        String(user.role || "user").toLowerCase() === "admin"
          ? "admin"
          : "user",

      is_active: Boolean(user.is_active),
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  /* ==========================================================
     FERMER MODALE
     ========================================================== */

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingUser(null);

    setForm({
      ...emptyForm,
    });

    setError("");
    setSuccess("");
  };

  /* ==========================================================
     VALIDATION FORMULAIRE
     ========================================================== */

  const validateForm = () => {
    if (!form.username.trim()) {
      return "Le nom d'utilisateur est requis.";
    }

    if (!form.email.trim()) {
      return "L'adresse e-mail est requise.";
    }

    if (!editingUser && !form.password) {
      return "Le mot de passe est requis.";
    }

    if (form.password) {
      if (form.password.length < 8) {
        return "Le mot de passe doit contenir au moins 8 caractères.";
      }

      if (
        form.password !==
        form.password_confirmation
      ) {
        return "Les mots de passe ne correspondent pas.";
      }
    }

    if (
      form.role !== "admin" &&
      form.role !== "user"
    ) {
      return "Le rôle sélectionné est invalide.";
    }

    return "";
  };

  /* ==========================================================
     ENREGISTREMENT
     ========================================================== */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      /* ------------------------------------------------------
         Validation
         ------------------------------------------------------ */

      const validationError = validateForm();

      if (validationError) {
        throw new Error(validationError);
      }

      /* ------------------------------------------------------
         Création / modification
         ------------------------------------------------------ */

      const isEditing = Boolean(editingUser);

      const url = isEditing
        ? `${API_URL}/auth/users/${editingUser.id}/`
        : `${API_URL}/auth/users/`;

      const method = isEditing
        ? "PUT"
        : "POST";

      /* ------------------------------------------------------
         Données envoyées au backend
         ------------------------------------------------------ */

      const body = {
        username: form.username.trim(),

        email: form.email.trim(),

        first_name: form.first_name.trim(),

        last_name: form.last_name.trim(),

        /*
         * IMPORTANT :
         * Django attend "admin" ou "user".
         */
        role: form.role.toLowerCase(),

        is_active: Boolean(form.is_active),
      };

      /* ------------------------------------------------------
         Mot de passe
         ------------------------------------------------------ */

      if (!isEditing || form.password) {
        body.password = form.password;

        body.password_confirmation =
          form.password_confirmation;
      }

      console.log(
        "Données envoyées à l'API :",
        body
      );

      /* ------------------------------------------------------
         Appel API
         ------------------------------------------------------ */

      const response = await fetch(
        url,
        {
          method,
          credentials: "include",
          headers: getHeaders(),
          body: JSON.stringify(body),
        }
      );

      const data =
        await response.json().catch(() => ({}));

      /* ------------------------------------------------------
         Gestion erreurs
         ------------------------------------------------------ */

      if (!response.ok) {
        const message =
          data?.message ||
          data?.detail ||
          data?.username?.[0] ||
          data?.email?.[0] ||
          data?.role?.[0] ||
          data?.password?.[0] ||
          data?.password_confirmation?.[0] ||
          "Une erreur est survenue lors de l'enregistrement.";

        throw new Error(message);
      }

      /* ------------------------------------------------------
         Succès
         ------------------------------------------------------ */

      setSuccess(
        isEditing
          ? "Utilisateur modifié avec succès."
          : "Utilisateur créé avec succès."
      );

      /* ------------------------------------------------------
         Recharger la liste
         ------------------------------------------------------ */

      await loadUsers();

      /* ------------------------------------------------------
         Fermeture automatique
         ------------------------------------------------------ */

      setTimeout(() => {
        setShowModal(false);
        setEditingUser(null);

        setForm({
          ...emptyForm,
        });

        setSuccess("");
      }, 700);

    } catch (err) {
      console.error(
        "Erreur lors de l'enregistrement :",
        err
      );

      setError(
        err.message ||
          "Erreur lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     SUPPRESSION
     ========================================================== */

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer l'utilisateur "${user.username}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/auth/users/${user.id}/`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getHeaders(),
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.detail ||
            "Impossible de supprimer cet utilisateur."
        );
      }

      setUsers((previous) =>
        Array.isArray(previous)
          ? previous.filter(
              (item) =>
                item.id !== user.id
            )
          : []
      );

      setSuccess(
        "Utilisateur supprimé avec succès."
      );
    } catch (err) {
      console.error(
        "Erreur lors de la suppression :",
        err
      );

      setError(
        err.message ||
          "Erreur lors de la suppression."
      );
    }
  };

  /* ==========================================================
     STATISTIQUES
     ========================================================== */

  const adminCount = Array.isArray(users)
    ? users.filter(
        (user) =>
          String(user.role || "").toLowerCase() ===
          "admin"
      ).length
    : 0;

  const standardUserCount = Array.isArray(users)
    ? users.filter(
        (user) =>
          String(user.role || "").toLowerCase() ===
          "user"
      ).length
    : 0;

  const activeUserCount = Array.isArray(users)
    ? users.filter(
        (user) => user.is_active
      ).length
    : 0;

  /* ==========================================================
     AFFICHAGE
     ========================================================== */

  return (
    <div className="users-page">

      {/* ======================================================
         EN-TETE
         ====================================================== */}

      <div className="users-page-header">

        <div>
          <h1>
            Gestion des utilisateurs
          </h1>

          <p>
            Gérez les comptes et les
            niveaux d'accès à HorizonOps.
          </p>
        </div>

        <div className="users-page-actions">

          <button
            type="button"
            className="users-refresh-button"
            onClick={loadUsers}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "users-spin"
                  : ""
              }
            />

            Actualiser
          </button>

          <button
            type="button"
            className="users-add-button"
            onClick={openCreateModal}
          >
            <Plus size={17} />

            Nouvel utilisateur
          </button>

        </div>

      </div>

      {/* ======================================================
         ALERTES
         ====================================================== */}

      {error && (
        <div className="users-alert users-alert-error">
          <UserX size={17} />

          <span>
            {error}
          </span>
        </div>
      )}

      {success && (
        <div className="users-alert users-alert-success">
          <CheckCircle2 size={17} />

          <span>
            {success}
          </span>
        </div>
      )}

      {/* ======================================================
         STATISTIQUES
         ====================================================== */}

      <div className="users-stats">

        <div className="users-stat-card">

          <div className="users-stat-icon">
            <Shield size={20} />
          </div>

          <div>

            <span>
              Administrateurs
            </span>

            <strong>
              {adminCount}
            </strong>

          </div>

        </div>

        <div className="users-stat-card">

          <div className="users-stat-icon">
            <UserCheck size={20} />
          </div>

          <div>

            <span>
              Utilisateurs standard
            </span>

            <strong>
              {standardUserCount}
            </strong>

          </div>

        </div>

        <div className="users-stat-card">

          <div className="users-stat-icon">
            <CheckCircle2 size={20} />
          </div>

          <div>

            <span>
              Comptes actifs
            </span>

            <strong>
              {activeUserCount}
            </strong>

          </div>

        </div>

      </div>

      {/* ======================================================
         TABLEAU
         ====================================================== */}

      <div className="users-table-card">

        <div className="users-table-wrapper">

          <table className="users-table">

            <thead>

              <tr>

                <th>
                  Utilisateur
                </th>

                <th>
                  E-mail
                </th>

                <th>
                  Rôle
                </th>

                <th>
                  État
                </th>

                <th>
                  Création
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan="6"
                    className="users-empty"
                  >
                    Chargement des utilisateurs...
                  </td>

                </tr>

              ) : !Array.isArray(users) ||
                users.length === 0 ? (

                <tr>

                  <td
                    colSpan="6"
                    className="users-empty"
                  >
                    Aucun utilisateur trouvé.
                  </td>

                </tr>

              ) : (

                users.map((user) => {

                  const isAdmin =
                    String(
                      user.role || ""
                    ).toLowerCase() ===
                    "admin";

                  return (
                    <tr key={user.id}>

                      <td>

                        <div className="users-user-cell">

                          <div className="users-avatar">

                            {user.username
                              ?.charAt(0)
                              ?.toUpperCase()}

                          </div>

                          <div>

                            <strong>
                              {user.username}
                            </strong>

                            <span>

                              {user.first_name ||
                              user.last_name
                                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                : "—"}

                            </span>

                          </div>

                        </div>

                      </td>

                      <td>
                        {user.email || "—"}
                      </td>

                      <td>

                        <span
                          className={
                            isAdmin
                              ? "users-role users-role-admin"
                              : "users-role users-role-user"
                          }
                        >

                          <Shield size={13} />

                          {isAdmin
                            ? "Administrateur"
                            : "Utilisateur standard"}

                        </span>

                      </td>

                      <td>

                        <span
                          className={
                            user.is_active
                              ? "users-status users-status-active"
                              : "users-status users-status-inactive"
                          }
                        >

                          {user.is_active
                            ? "Actif"
                            : "Inactif"}

                        </span>

                      </td>

                      <td>

                        {user.date_creation
                          ? new Date(
                              user.date_creation
                            ).toLocaleDateString(
                              "fr-FR"
                            )
                          : user.date_joined
                            ? new Date(
                                user.date_joined
                              ).toLocaleDateString(
                                "fr-FR"
                              )
                            : "—"}

                      </td>

                      <td>

                        <div className="users-actions">

                          <button
                            type="button"
                            title="Modifier"
                            aria-label={`Modifier ${user.username}`}
                            className="users-action-edit"
                            onClick={() =>
                              openEditModal(user)
                            }
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            type="button"
                            title="Supprimer"
                            aria-label={`Supprimer ${user.username}`}
                            className="users-action-delete"
                            onClick={() =>
                              handleDelete(user)
                            }
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                })

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================================
         MODALE
         ====================================================== */}

      {showModal && (

        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }

          }}
        >

          <div className="users-modal">

            {/* HEADER */}

            <div className="users-modal-header">

              <div>

                <h2>
                  {editingUser
                    ? "Modifier l'utilisateur"
                    : "Nouvel utilisateur"}
                </h2>

                <p>
                  Configurez les informations
                  et les droits du compte.
                </p>

              </div>

              <button
                type="button"
                className="users-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fermer"
              >
                <X size={19} />
              </button>

            </div>

            {/* FORMULAIRE */}

            <form
              className="users-form"
              onSubmit={handleSubmit}
            >

              <div className="users-form-grid">

                {/* Username */}

                <div className="users-field">

                  <label htmlFor="users-username">
                    Nom d'utilisateur
                  </label>

                  <input
                    id="users-username"
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                    autoComplete="username"
                  />

                </div>

                {/* Email */}

                <div className="users-field">

                  <label htmlFor="users-email">
                    Adresse e-mail
                  </label>

                  <input
                    id="users-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                  />

                </div>

                {/* Prénom */}

                <div className="users-field">

                  <label htmlFor="users-first-name">
                    Prénom
                  </label>

                  <input
                    id="users-first-name"
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    autoComplete="given-name"
                  />

                </div>

                {/* Nom */}

                <div className="users-field">

                  <label htmlFor="users-last-name">
                    Nom
                  </label>

                  <input
                    id="users-last-name"
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    autoComplete="family-name"
                  />

                </div>

                {/* ROLE */}

                <div className="users-field">

                  <label htmlFor="users-role">
                    Rôle
                  </label>

                  <select
                    id="users-role"
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                  >

                    <option value="user">
                      Utilisateur standard
                    </option>

                    <option value="admin">
                      Administrateur
                    </option>

                  </select>

                </div>

                {/* Compte actif */}

                <div className="users-field users-checkbox-field">

                  <label>

                    <input
                      type="checkbox"
                      name="is_active"
                      checked={form.is_active}
                      onChange={handleChange}
                    />

                    <span>
                      Compte actif
                    </span>

                  </label>

                </div>

                {/* Mot de passe */}

                <div className="users-field">

                  <label htmlFor="users-password">

                    {editingUser
                      ? "Nouveau mot de passe"
                      : "Mot de passe"}

                  </label>

                  <input
                    id="users-password"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required={!editingUser}
                    minLength={8}
                    autoComplete="new-password"
                  />

                  {editingUser && (
                    <small>
                      Laissez vide pour conserver
                      le mot de passe actuel.
                    </small>
                  )}

                </div>

                {/* Confirmation */}

                <div className="users-field">

                  <label htmlFor="users-password-confirmation">
                    Confirmation
                  </label>

                  <input
                    id="users-password-confirmation"
                    type="password"
                    name="password_confirmation"
                    value={
                      form.password_confirmation
                    }
                    onChange={handleChange}
                    required={!editingUser}
                    minLength={8}
                    autoComplete="new-password"
                  />

                </div>

              </div>

              {/* INFORMATION ROLE */}

              <div className="users-role-info">

                <Shield size={17} />

                <div>

                  <strong>

                    {form.role === "admin"
                      ? "Administrateur"
                      : "Utilisateur standard"}

                  </strong>

                  <p>

                    {form.role === "admin"
                      ? "Accès complet à la plateforme, aux opérations d'infrastructure et à la gestion des utilisateurs."
                      : "Accès aux informations et aux fonctions de consultation. Les opérations de modification sont protégées."}

                  </p>

                </div>

              </div>

              {/* ERREUR */}

              {error && (

                <div className="users-form-error">
                  {error}
                </div>

              )}

              {/* SUCCES */}

              {success && (

                <div className="users-form-success">
                  {success}
                </div>

              )}

              {/* FOOTER */}

              <div className="users-modal-footer">

                <button
                  type="button"
                  className="users-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="users-save-button"
                  disabled={saving}
                >

                  {saving
                    ? "Enregistrement..."
                    : editingUser
                      ? "Enregistrer"
                      : "Créer l'utilisateur"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default Users;