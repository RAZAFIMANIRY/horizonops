import { useEffect, useState } from "react";
import {
  Camera,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import { apiFetch } from "../api";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getErrorMessage(data) {
  if (!data) {
    return "Une erreur est survenue.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.error) {
    return data.error;
  }

  if (data.detail) {
    return data.detail;
  }

  if (data.message) {
    return data.message;
  }

  return "Une erreur est survenue.";
}

function formatSnapshotDate(value) {
  if (!value) {
    return "Date inconnue";
  }

  /*
   * Proxmox peut retourner
   * snaptime sous forme de timestamp Unix.
   */
  if (
    typeof value === "number" ||
    !Number.isNaN(Number(value))
  ) {
    const timestamp = Number(value);

    if (timestamp > 0) {
      return new Date(
        timestamp * 1000
      ).toLocaleString("fr-FR");
    }
  }

  /*
   * Sinon on tente une date classique.
   */
  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString("fr-FR");
  }

  return String(value);
}

function normalizeSnapshots(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.snapshots)) {
    return data.snapshots;
  }

  if (Array.isArray(data.data?.snapshots)) {
    return data.data.snapshots;
  }

  if (Array.isArray(data.result)) {
    return data.result;
  }

  if (Array.isArray(data.data?.result)) {
    return data.data.result;
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| Snapshot creation modal
|--------------------------------------------------------------------------
*/

function SnapshotCreateModal({
  onClose,
  onCreate,
  loading,
}) {
  const [snapname, setSnapname] =
    useState("");

  const [description, setDescription] =
    useState("");

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    const name = snapname.trim();

    if (!name) {
      return;
    }

    await onCreate({
      snapname: name,
      description:
        description.trim(),
    });
  };

  return (
    <div
      className="proxmox-modal-overlay"
      onClick={onClose}
    >
      <div
        className="proxmox-modal snapshot-create-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="proxmox-modal-header">
          <div>
            <span className="eyebrow">
              PROXMOX / SNAPSHOT
            </span>

            <h2>
              Créer un snapshot
            </h2>
          </div>

          <button
            type="button"
            className="proxmox-modal-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={19} />
          </button>
        </div>

        <form
          className="proxmox-form"
          onSubmit={handleSubmit}
        >
          <div className="proxmox-form-group">
            <label>
              Nom du snapshot
            </label>

            <input
              type="text"
              value={snapname}
              onChange={(event) =>
                setSnapname(
                  event.target.value
                )
              }
              placeholder="avant-mise-a-jour"
              required
              disabled={loading}
            />

            <small>
              Utilisez un nom simple, sans
              espace.
            </small>
          </div>

          <div className="proxmox-form-group">
            <label>
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="État avant la mise à jour..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="proxmox-modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={
                loading ||
                !snapname.trim()
              }
            >
              {loading ? (
                <RefreshCw
                  size={16}
                  className="spin"
                />
              ) : (
                <Plus size={16} />
              )}

              {loading
                ? "Création..."
                : "Créer le snapshot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Confirmation modal
|--------------------------------------------------------------------------
*/

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
  loading,
  danger = false,
}) {
  return (
    <div
      className="proxmox-modal-overlay"
      onClick={onClose}
    >
      <div
        className="proxmox-modal snapshot-confirm-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="proxmox-modal-header">
          <div>
            <span className="eyebrow">
              HORIZONOPS / CONFIRMATION
            </span>

            <h2>{title}</h2>
          </div>

          <button
            type="button"
            className="proxmox-modal-close"
            onClick={onClose}
            disabled={loading}
          >
            <X size={19} />
          </button>
        </div>

        <div className="snapshot-confirm-content">
          <AlertCircle size={34} />

          <p>{message}</p>
        </div>

        <div className="proxmox-modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </button>

          <button
            type="button"
            className={
              danger
                ? "danger-button"
                : "primary-button"
            }
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <RefreshCw
                size={16}
                className="spin"
              />
            )}

            {!loading && (
              <>
                {danger ? (
                  <Trash2 size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
              </>
            )}

            {loading
              ? "Traitement..."
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Main component
|--------------------------------------------------------------------------
*/

function VMSnapshots({
  vmid,
}) {
  const [snapshots, setSnapshots] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [confirmAction, setConfirmAction] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | Load snapshots
  |--------------------------------------------------------------------------
  */

  const loadSnapshots = async (
    showRefresh = false
  ) => {
    if (!vmid) {
      setSnapshots([]);
      setLoading(false);
      return;
    }

    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setSuccess("");

      /*
       * IMPORTANT :
       * On utilise apiFetch() et non fetch().
       *
       * apiFetch() gère l'authentification
       * de la session HorizonOps.
       */
      const response = await apiFetch(
        `/vms/${vmid}/snapshots/`
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      console.log(
        "[HorizonOps] Réponse snapshots :",
        data
      );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      const snapshotList =
        normalizeSnapshots(data);

      console.log(
        "[HorizonOps] Snapshots normalisés :",
        snapshotList
      );

      setSnapshots(snapshotList);
    } catch (err) {
      console.error(
        "[HorizonOps] Erreur snapshots :",
        err
      );

      setSnapshots([]);

      setError(
        err.message ||
          "Impossible de récupérer les snapshots."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Initial loading
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadSnapshots();
  }, [vmid]);

  /*
  |--------------------------------------------------------------------------
  | Create snapshot
  |--------------------------------------------------------------------------
  */

  const createSnapshot = async ({
    snapname,
    description,
  }) => {
    try {
      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/vms/${vmid}/snapshots/`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            snapname,
            description,
          }),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      console.log(
        "[HorizonOps] Création snapshot :",
        data
      );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      setShowCreate(false);

      setSuccess(
        `Le snapshot « ${snapname} » a été créé avec succès.`
      );

      await loadSnapshots(true);
    } catch (err) {
      console.error(
        "[HorizonOps] Erreur création snapshot :",
        err
      );

      setError(
        err.message ||
          "Impossible de créer le snapshot."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Delete snapshot
  |--------------------------------------------------------------------------
  */

  const deleteSnapshot = async (
    snapshot
  ) => {
    const snapname =
      snapshot?.name ||
      snapshot?.snapname;

    if (!snapname) {
      setError(
        "Nom du snapshot introuvable."
      );
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/vms/${vmid}/snapshots/${encodeURIComponent(
          snapname
        )}/delete/`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      setConfirmAction(null);

      setSuccess(
        `Le snapshot « ${snapname} » a été supprimé.`
      );

      await loadSnapshots(true);
    } catch (err) {
      console.error(
        "[HorizonOps] Erreur suppression snapshot :",
        err
      );

      setError(
        err.message ||
          "Impossible de supprimer le snapshot."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Rollback snapshot
  |--------------------------------------------------------------------------
  */

  const rollbackSnapshot = async (
    snapshot
  ) => {
    const snapname =
      snapshot?.name ||
      snapshot?.snapname;

    if (!snapname) {
      setError(
        "Nom du snapshot introuvable."
      );
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await apiFetch(
        `/vms/${vmid}/snapshots/${encodeURIComponent(
          snapname
        )}/rollback/`,
        {
          method: "POST",
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data)
        );
      }

      setConfirmAction(null);

      setSuccess(
        `La VM a été restaurée depuis « ${snapname} ».`
      );

      await loadSnapshots(true);
    } catch (err) {
      console.error(
        "[HorizonOps] Erreur restauration snapshot :",
        err
      );

      setError(
        err.message ||
          "Impossible de restaurer le snapshot."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Invalid VMID
  |--------------------------------------------------------------------------
  */

  if (!vmid) {
    return (
      <div className="snapshot-empty">
        <AlertCircle size={25} />

        <strong>
          VM non sélectionnée
        </strong>

        <span>
          Aucun identifiant de VM n'a été
          fourni.
        </span>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="vm-snapshots-section">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="vm-snapshots-header">

        <div className="vm-snapshots-title">

          <div className="snapshot-title-icon">
            <Camera size={19} />
          </div>

          <div>
            <h3>
              Snapshots
            </h3>

            <span>
              VMID {vmid}
            </span>
          </div>

        </div>

        <div className="snapshot-header-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              loadSnapshots(true)
            }
            disabled={
              refreshing ||
              loading
            }
            title="Actualiser"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />

            Actualiser
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowCreate(true)
            }
            disabled={loading}
          >
            <Plus size={16} />

            Créer
          </button>

        </div>

      </div>

      {/* =================================================
          SUCCESS
      ================================================= */}

      {success && (
        <div className="snapshot-alert success">
          <CheckCircle2 size={17} />

          <span>
            {success}
          </span>
        </div>
      )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="snapshot-alert error">
          <AlertCircle size={17} />

          <span>
            {error}
          </span>
        </div>
      )}

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (

        <div className="snapshot-empty">

          <RefreshCw
            size={25}
            className="spin"
          />

          <strong>
            Chargement des snapshots...
          </strong>

        </div>

      ) : snapshots.length === 0 ? (

        <div className="snapshot-empty">

          <Camera size={30} />

          <strong>
            Aucun snapshot
          </strong>

          <span>
            Cette VM ne possède
            actuellement aucun point
            de restauration.
          </span>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              setShowCreate(true)
            }
          >
            <Plus size={16} />

            Créer le premier snapshot
          </button>

        </div>

      ) : (

        <div className="snapshots-list">

          {snapshots.map(
            (snapshot, index) => {

              const snapshotName =
                snapshot.name ||
                snapshot.snapname ||
                `snapshot-${index + 1}`;

              const description =
                snapshot.description ||
                "Aucune description";

              const snapshotTime =
                snapshot.snaptime ||
                snapshot.created_at ||
                snapshot.created ||
                null;

              return (
                <div
                  className="snapshot-card"
                  key={`${snapshotName}-${index}`}
                >

                  <div className="snapshot-card-main">

                    <div className="snapshot-card-icon">
                      <Camera size={18} />
                    </div>

                    <div className="snapshot-card-info">

                      <h4>
                        {snapshotName}
                      </h4>

                      <p>
                        {description}
                      </p>

                      <span>
                        <Clock3
                          size={13}
                        />

                        {formatSnapshotDate(
                          snapshotTime
                        )}
                      </span>

                    </div>

                  </div>

                  <div className="snapshot-card-actions">

                    <button
                      type="button"
                      className="action-button restart"
                      onClick={() =>
                        setConfirmAction({
                          type: "rollback",
                          snapshot,
                        })
                      }
                      title="Restaurer"
                    >
                      <RotateCcw
                        size={15}
                      />
                    </button>

                    <button
                      type="button"
                      className="action-button stop"
                      onClick={() =>
                        setConfirmAction({
                          type: "delete",
                          snapshot,
                        })
                      }
                      title="Supprimer"
                    >
                      <Trash2
                        size={15}
                      />
                    </button>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}

      {/* =================================================
          CREATE MODAL
      ================================================= */}

      {showCreate && (
        <SnapshotCreateModal
          onClose={() =>
            setShowCreate(false)
          }
          onCreate={
            createSnapshot
          }
          loading={false}
        />
      )}

      {/* =================================================
          CONFIRMATION
      ================================================= */}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type ===
            "delete"
              ? "Supprimer le snapshot ?"
              : "Restaurer le snapshot ?"
          }
          message={
            confirmAction.type ===
            "delete"
              ? `Le snapshot « ${
                  confirmAction.snapshot?.name ||
                  confirmAction.snapshot?.snapname
                } » sera supprimé définitivement.`
              : `La VM sera restaurée à l'état du snapshot « ${
                  confirmAction.snapshot?.name ||
                  confirmAction.snapshot?.snapname
                } ».`
          }
          confirmLabel={
            confirmAction.type ===
            "delete"
              ? "Supprimer"
              : "Restaurer"
          }
          danger={
            confirmAction.type ===
            "delete"
          }
          onClose={() =>
            setConfirmAction(null)
          }
          onConfirm={() => {
            if (
              confirmAction.type ===
              "delete"
            ) {
              deleteSnapshot(
                confirmAction.snapshot
              );
            } else {
              rollbackSnapshot(
                confirmAction.snapshot
              );
            }
          }}
          loading={false}
        />
      )}

    </div>
  );
}

export default VMSnapshots;