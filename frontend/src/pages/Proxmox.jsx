import { useEffect, useState } from "react";
import {
  Server,
  Container,
  Play,
  Square,
  RotateCcw,
  Plus,
  RefreshCw,
  Activity,
  HardDrive,
  Cpu,
  MemoryStick,
  Clock3,
  Network,
  AlertCircle,
  X,
  Camera,
} from "lucide-react";

import { apiFetch } from "../api";
import VMSnapshots from "./VMSnapshots";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatMemory(bytes) {
  if (!bytes) return "0 MB";

  const mb = Number(bytes) / 1024 / 1024;

  if (!Number.isFinite(mb)) {
    return "0 MB";
  }

  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }

  return `${mb.toFixed(0)} MB`;
}

function formatDisk(bytes) {
  if (!bytes) return "0 GB";

  const gb =
    Number(bytes) /
    1024 /
    1024 /
    1024;

  if (!Number.isFinite(gb)) {
    return "0 GB";
  }

  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds) {
  if (!seconds) return "—";

  const value = Number(seconds);

  if (!Number.isFinite(value)) {
    return "—";
  }

  const days = Math.floor(value / 86400);

  const hours = Math.floor(
    (value % 86400) / 3600
  );

  const minutes = Math.floor(
    (value % 3600) / 60
  );

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function ResourceBar({ value = 0 }) {
  const numericValue = Number(value);

  const percentage = Math.min(
    100,
    Math.max(
      0,
      Number.isFinite(numericValue)
        ? numericValue * 100
        : 0
    )
  );

  return (
    <div className="resource-bar">
      <div
        className="resource-bar-fill"
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Initial form
|--------------------------------------------------------------------------
*/

const initialForm = {
  vmid: "",
  name: "",
  cores: 1,
  memory: 1024,
  disk: 10,
  iso: "",
  ostemplate: "",
  password: "",
  ip: "",
  gateway: "",
  bridge: "",
  vlan: "",
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

function Proxmox() {
  /*
  |--------------------------------------------------------------------------
  | Resources
  |--------------------------------------------------------------------------
  */

  const [resources, setResources] = useState([]);

  const [isos, setIsos] = useState([]);

  /*
  |--------------------------------------------------------------------------
  | Snapshot
  |--------------------------------------------------------------------------
  */

  const [snapshotVM, setSnapshotVM] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [loadingIsos, setLoadingIsos] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Errors
  |--------------------------------------------------------------------------
  */

  const [error, setError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | Actions
  |--------------------------------------------------------------------------
  */

  const [actionLoading, setActionLoading] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | Creation modal
  |--------------------------------------------------------------------------
  */

  const [showCreate, setShowCreate] =
    useState(false);

  const [resourceType, setResourceType] =
    useState("vm");

  const [form, setForm] =
    useState(initialForm);

  /*
  |--------------------------------------------------------------------------
  | Load VM + LXC
  |--------------------------------------------------------------------------
  */

  const loadResources = async (
    showRefresh = false
  ) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      setError("");

      const [
        vmResponse,
        lxcResponse,
      ] = await Promise.all([
        apiFetch("/vms/"),
        apiFetch("/vms/containers/"),
      ]);

      if (!vmResponse.ok) {
        const data =
          await vmResponse
            .json()
            .catch(() => ({}));

        throw new Error(
          data.error ||
            "Impossible de récupérer les VM Proxmox."
        );
      }

      if (!lxcResponse.ok) {
        const data =
          await lxcResponse
            .json()
            .catch(() => ({}));

        throw new Error(
          data.error ||
            "Impossible de récupérer les conteneurs LXC."
        );
      }

      const vms =
        await vmResponse.json();

      const containers =
        await lxcResponse.json();

      const normalizedVMs =
        Array.isArray(vms)
          ? vms.map((vm) => ({
              ...vm,
              type: "vm",
            }))
          : [];

      const normalizedContainers =
        Array.isArray(containers)
          ? containers.map(
              (container) => ({
                ...container,
                type: "lxc",
                name:
                  container.hostname ||
                  `LXC ${container.vmid}`,
              })
            )
          : [];

      setResources([
        ...normalizedVMs,
        ...normalizedContainers,
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Erreur de connexion à Proxmox."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Load ISO
  |--------------------------------------------------------------------------
  */

  const loadISOs = async () => {
    try {
      setLoadingIsos(true);

      setError("");

      const response =
        await apiFetch("/vms/isos/");

      const data =
        await response
          .json()
          .catch(() => []);

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Impossible de récupérer les images ISO."
        );
      }

      if (Array.isArray(data)) {
        setIsos(data);
      } else {
        setIsos([]);
      }
    } catch (err) {
      setError(
        err.message ||
          "Impossible de récupérer les ISO."
      );

      setIsos([]);
    } finally {
      setLoadingIsos(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Initial loading + auto refresh
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadResources();

    const interval = setInterval(() => {
      loadResources();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Open creation modal
  |--------------------------------------------------------------------------
  */

  const openCreateModal = () => {
    setError("");

    setResourceType("vm");

    setForm({
      ...initialForm,
    });

    setShowCreate(true);

    loadISOs();
  };

  /*
  |--------------------------------------------------------------------------
  | Close creation modal
  |--------------------------------------------------------------------------
  */

  const closeModal = () => {
    setShowCreate(false);

    setResourceType("vm");

    setForm({
      ...initialForm,
    });

    setError("");
  };

  /*
  |--------------------------------------------------------------------------
  | Snapshot modal
  |--------------------------------------------------------------------------
  */

  const openSnapshotModal = (resource) => {
    if (!resource) {
      return;
    }

    if (resource.type !== "vm") {
      return;
    }

    setError("");

    setSnapshotVM(resource);
  };

  const closeSnapshotModal = () => {
    setSnapshotVM(null);
  };

  /*
  |--------------------------------------------------------------------------
  | Form change
  |--------------------------------------------------------------------------
  */

  const handleFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /*
  |--------------------------------------------------------------------------
  | Execute VM / LXC action
  |--------------------------------------------------------------------------
  */

  const executeAction = async (
    resource,
    action
  ) => {
    try {
      setError("");

      const actionKey =
        `${resource.type}-${resource.vmid}-${action}`;

      setActionLoading(actionKey);

      const endpoint =
        resource.type === "lxc"
          ? `/vms/containers/${resource.vmid}/${action}/`
          : `/vms/${resource.vmid}/${action}/`;

      const response =
        await apiFetch(endpoint, {
          method: "POST",
        });

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Action impossible."
        );
      }

      await loadResources();
    } catch (err) {
      setError(
        err.message ||
          "Impossible d'exécuter l'action."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Create VM / LXC
  |--------------------------------------------------------------------------
  */

  const createResource = async (
    event
  ) => {
    event.preventDefault();

    try {
      setError("");

      /*
      |--------------------------------------------------------------------------
      | VM
      |--------------------------------------------------------------------------
      */

      if (resourceType === "vm") {
        if (!form.vmid) {
          throw new Error(
            "Le VMID est obligatoire."
          );
        }

        if (!form.name.trim()) {
          throw new Error(
            "Le nom de la VM est obligatoire."
          );
        }

        if (!form.iso) {
          throw new Error(
            "Veuillez sélectionner une image ISO."
          );
        }

        const payload = {
          vmid: Number(form.vmid),

          name: form.name.trim(),

          memory: Number(form.memory),

          cores: Number(form.cores),

          disk: Number(form.disk),

          iso: form.iso,

          ...(form.bridge.trim()
            ? {
                bridge:
                  form.bridge.trim(),
              }
            : {}),

          ...(form.vlan !== ""
            ? {
                vlan: Number(form.vlan),
              }
            : {}),
        };

        const response =
          await apiFetch(
            "/vms/create/",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                payload
              ),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          if (
            data.fields &&
            Array.isArray(data.fields)
          ) {
            throw new Error(
              `${data.error || "Paramètres manquants."} ${data.fields.join(", ")}`
            );
          }

          throw new Error(
            data.error ||
              "Impossible de créer la VM."
          );
        }

        closeModal();

        await loadResources();

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | LXC
      |--------------------------------------------------------------------------
      */

      if (resourceType === "lxc") {
        throw new Error(
          "La création des conteneurs LXC n'est pas encore disponible côté backend."
        );
      }
    } catch (err) {
      setError(
        err.message ||
          "Impossible de créer la ressource."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Statistics
  |--------------------------------------------------------------------------
  */

  const runningCount =
    resources.filter(
      (resource) =>
        resource.status === "running"
    ).length;

  const stoppedCount =
    resources.length -
    runningCount;

  const vmCount =
    resources.filter(
      (resource) =>
        resource.type === "vm"
    ).length;

  const lxcCount =
    resources.filter(
      (resource) =>
        resource.type === "lxc"
    ).length;

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="page-heading">

        <div>
          <span className="eyebrow">
            VIRTUALIZATION
          </span>

          <h1>Proxmox VE</h1>

          <p>
            Gestion centralisée des machines
            virtuelles et conteneurs.
          </p>
        </div>

        <div className="page-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              loadResources(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
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
            onClick={
              openCreateModal
            }
          >
            <Plus size={18} />

            Créer VM / LXC
          </button>

        </div>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      {!loading && (
        <div className="vm-summary">

          <div className="summary-card">

            <div className="summary-icon">
              <Server size={19} />
            </div>

            <div>
              <span>
                Ressources
              </span>

              <strong>
                {resources.length}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="summary-icon">
              <Activity size={19} />
            </div>

            <div>
              <span>
                Running
              </span>

              <strong>
                {runningCount}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="summary-icon">
              <Server size={19} />
            </div>

            <div>
              <span>
                QEMU
              </span>

              <strong>
                {vmCount}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="summary-icon">
              <Container size={19} />
            </div>

            <div>
              <span>
                LXC
              </span>

              <strong>
                {lxcCount}
              </strong>
            </div>

          </div>

          <div className="summary-card">

            <div className="summary-icon">
              <Square size={19} />
            </div>

            <div>
              <span>
                Arrêtées
              </span>

              <strong>
                {stoppedCount}
              </strong>
            </div>

          </div>

        </div>
      )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="error-banner">

          <AlertCircle size={17} />

          <span>
            {error}
          </span>

        </div>
      )}

      {/* =================================================
          CONTENT
      ================================================= */}

      {loading ? (

        <div className="loading-state">

          <RefreshCw
            size={23}
            className="spin"
          />

          <span>
            Connexion à Proxmox VE...
          </span>

        </div>

      ) : resources.length === 0 ? (

        <div className="empty-state">

          <Server size={40} />

          <h3>
            Aucune ressource
          </h3>

          <p>
            Aucune VM ou aucun conteneur
            LXC disponible.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={
              openCreateModal
            }
          >
            <Plus size={17} />

            Créer VM / LXC
          </button>

        </div>

      ) : (

        <div className="vm-grid">

          {resources.map(
            (resource) => {

              /*
              |--------------------------------------------------------------------------
              | Resource calculations
              |--------------------------------------------------------------------------
              */

              const cpu =
                Number(
                  resource.cpu || 0
                );

              const memory =
                resource.maxmem
                  ? Number(
                      resource.mem || 0
                    ) /
                    Number(
                      resource.maxmem
                    )
                  : 0;

              const disk =
                resource.maxdisk
                  ? Number(
                      resource.disk || 0
                    ) /
                    Number(
                      resource.maxdisk
                    )
                  : 0;

              const isRunning =
                resource.status ===
                "running";

              const isLXC =
                resource.type ===
                "lxc";

              /*
              |--------------------------------------------------------------------------
              | Current action
              |--------------------------------------------------------------------------
              */

              const actionKey =
                `${resource.type}-${resource.vmid}`;

              const action =
                actionLoading?.startsWith(
                  actionKey
                )
                  ? actionLoading.replace(
                      `${actionKey}-`,
                      ""
                    )
                  : null;

              return (
                <div
                  className="vm-card"
                  key={`${resource.type}-${resource.vmid}`}
                >

                  {/* =================================================
                      CARD HEADER
                  ================================================= */}

                  <div className="vm-card-header">

                    <div className="vm-title">

                      <div className="vm-icon">

                        {isLXC ? (
                          <Container
                            size={20}
                          />
                        ) : (
                          <Server
                            size={20}
                          />
                        )}

                      </div>

                      <div>

                        <h3>
                          {resource.name ||
                            `VM ${resource.vmid}`}
                        </h3>

                        <span>
                          VMID{" "}
                          {resource.vmid}
                          {" · "}
                          {isLXC
                            ? "LXC"
                            : "QEMU"}
                        </span>

                      </div>

                    </div>

                    <span
                      className={
                        isRunning
                          ? "status-badge running"
                          : "status-badge stopped"
                      }
                    >
                      <span />

                      {resource.status ||
                        "unknown"}
                    </span>

                  </div>

                  {/* =================================================
                      RESOURCE INFORMATION
                  ================================================= */}

                  <div className="vm-info-grid">

                    {/* CPU */}

                    <div className="resource-item">

                      <div className="resource-label">

                        <span>
                          <Cpu size={13} />
                          CPU
                        </span>

                        <strong>
                          {(
                            cpu * 100
                          ).toFixed(1)}
                          %
                        </strong>

                      </div>

                      <ResourceBar
                        value={cpu}
                      />

                    </div>

                    {/* MEMORY */}

                    <div className="resource-item">

                      <div className="resource-label">

                        <span>
                          <MemoryStick
                            size={13}
                          />
                          MEMORY
                        </span>

                        <strong>
                          {formatMemory(
                            resource.mem
                          )}
                        </strong>

                      </div>

                      <ResourceBar
                        value={memory}
                      />

                    </div>

                    {/* DISK */}

                    <div className="resource-item">

                      <div className="resource-label">

                        <span>
                          <HardDrive
                            size={13}
                          />
                          DISK
                        </span>

                        <strong>
                          {formatDisk(
                            resource.disk
                          )}
                        </strong>

                      </div>

                      <ResourceBar
                        value={disk}
                      />

                    </div>

                    {/* UPTIME */}

                    <div className="resource-item">

                      <div className="resource-label">

                        <span>
                          <Clock3
                            size={13}
                          />
                          UPTIME
                        </span>

                        <strong>
                          {formatUptime(
                            resource.uptime
                          )}
                        </strong>

                      </div>

                    </div>

                  </div>

                  {/* =================================================
                      FOOTER
                  ================================================= */}

                  <div className="vm-footer">

                    <div className="vm-network">

                      <span>
                        <Network size={13} />
                        IP
                      </span>

                      <strong>
                        {resource.ip ||
                          "—"}
                      </strong>

                    </div>

                    {/* ACTIONS */}

                    <div className="vm-actions">

                      {/* SNAPSHOTS */}

                      {!isLXC && (
                        <button
                          type="button"
                          className="action-button snapshot"
                          onClick={() =>
                            openSnapshotModal(
                              resource
                            )
                          }
                          title="Gérer les snapshots"
                        >
                          <Camera
                            size={15}
                          />
                        </button>
                      )}

                      {/* START */}

                      {!isRunning && (
                        <button
                          type="button"
                          className="action-button start"
                          disabled={
                            actionLoading !==
                            null
                          }
                          onClick={() =>
                            executeAction(
                              resource,
                              "start"
                            )
                          }
                          title="Démarrer"
                        >
                          {action ===
                          "start" ? (
                            <RefreshCw
                              size={15}
                              className="spin"
                            />
                          ) : (
                            <Play
                              size={15}
                            />
                          )}
                        </button>
                      )}

                      {/* RUNNING ACTIONS */}

                      {isRunning && (
                        <>
                          {/* REBOOT */}

                          <button
                            type="button"
                            className="action-button restart"
                            disabled={
                              actionLoading !==
                              null
                            }
                            onClick={() =>
                              executeAction(
                                resource,
                                "reboot"
                              )
                            }
                            title="Redémarrer"
                          >
                            {action ===
                            "reboot" ? (
                              <RefreshCw
                                size={15}
                                className="spin"
                              />
                            ) : (
                              <RotateCcw
                                size={15}
                              />
                            )}
                          </button>

                          {/* STOP */}

                          <button
                            type="button"
                            className="action-button stop"
                            disabled={
                              actionLoading !==
                              null
                            }
                            onClick={() =>
                              executeAction(
                                resource,
                                "stop"
                              )
                            }
                            title="Arrêter"
                          >
                            {action ===
                            "stop" ? (
                              <RefreshCw
                                size={15}
                                className="spin"
                              />
                            ) : (
                              <Square
                                size={15}
                              />
                            )}
                          </button>
                        </>
                      )}

                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}

      {/* =============================================================
          SNAPSHOT MODAL
      ============================================================= */}

      {snapshotVM && (
        <div
          className="proxmox-modal-overlay"
          onClick={closeSnapshotModal}
        >
          <div
            className="proxmox-modal proxmox-snapshot-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="proxmox-modal-header">

              <div>

                <span className="eyebrow">
                  PROXMOX / SNAPSHOTS
                </span>

                <h2>
                  Snapshots —{" "}
                  {snapshotVM.name ||
                    `VM ${snapshotVM.vmid}`}
                </h2>

                <p className="snapshot-modal-subtitle">
                  VMID {snapshotVM.vmid} · QEMU
                </p>

              </div>

              <button
                type="button"
                className="proxmox-modal-close"
                onClick={
                  closeSnapshotModal
                }
                aria-label="Fermer"
              >
                <X size={19} />
              </button>

            </div>

            <div className="snapshot-modal-content">

              <VMSnapshots
                vmid={snapshotVM.vmid}
              />

            </div>

          </div>
        </div>
      )}

      {/* =============================================================
          CREATE VM / LXC MODAL
      ============================================================= */}

      {showCreate && (
        <div
          className="proxmox-modal-overlay"
          onClick={closeModal}
        >

          <div
            className="proxmox-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div className="proxmox-modal-header">

              <div>

                <span className="eyebrow">
                  PROXMOX / CREATE
                </span>

                <h2>
                  Créer une ressource
                </h2>

              </div>

              <button
                type="button"
                className="proxmox-modal-close"
                onClick={closeModal}
              >
                <X size={19} />
              </button>

            </div>

            {/* =================================================
                RESOURCE TYPE
            ================================================= */}

            <div className="resource-type-selector">

              {/* VM */}

              <button
                type="button"
                className={`resource-type-option ${
                  resourceType === "vm"
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setResourceType("vm");
                  setError("");
                }}
              >

                <div className="resource-type-icon">
                  <Server size={19} />
                </div>

                <div>

                  <strong>
                    Machine virtuelle
                  </strong>

                  <span>
                    QEMU / KVM
                  </span>

                </div>

              </button>

              {/* LXC */}

              <button
                type="button"
                className={`resource-type-option ${
                  resourceType === "lxc"
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setResourceType("lxc");
                  setError("");
                }}
              >

                <div className="resource-type-icon">

                  <Container size={19} />

                </div>

                <div>

                  <strong>
                    Conteneur
                  </strong>

                  <span>
                    Linux Container
                  </span>

                </div>

              </button>

            </div>

            {/* =================================================
                FORM
            ================================================= */}

            <form
              className="proxmox-form"
              onSubmit={
                createResource
              }
            >

              {/* =================================================
                  GENERAL CONFIGURATION
              ================================================= */}

              <div className="proxmox-section-title">
                Configuration générale
              </div>

              <div className="proxmox-form-grid">

                {/* VMID */}

                <div className="proxmox-form-group">

                  <label>
                    VMID
                  </label>

                  <input
                    type="number"
                    name="vmid"
                    value={form.vmid}
                    onChange={
                      handleFormChange
                    }
                    placeholder="101"
                    min="100"
                    required
                  />

                  <small>
                    Identifiant unique
                    Proxmox.
                  </small>

                </div>

                {/* NAME */}

                <div className="proxmox-form-group">

                  <label>
                    Nom
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={
                      handleFormChange
                    }
                    placeholder={
                      resourceType ===
                      "vm"
                        ? "web-server"
                        : "app-container"
                    }
                    required
                  />

                </div>

                {/* CPU */}

                <div className="proxmox-form-group">

                  <label>
                    CPU / Cœurs
                  </label>

                  <input
                    type="number"
                    name="cores"
                    value={form.cores}
                    onChange={
                      handleFormChange
                    }
                    min="1"
                    max="16"
                    required
                  />

                </div>

                {/* MEMORY */}

                <div className="proxmox-form-group">

                  <label>
                    Mémoire (MB)
                  </label>

                  <input
                    type="number"
                    name="memory"
                    value={form.memory}
                    onChange={
                      handleFormChange
                    }
                    min="128"
                    required
                  />

                </div>

                {/* DISK */}

                <div className="proxmox-form-group">

                  <label>
                    Disque (GB)
                  </label>

                  <input
                    type="number"
                    name="disk"
                    value={form.disk}
                    onChange={
                      handleFormChange
                    }
                    min="1"
                    required
                  />

                </div>

                {/* IP */}

                <div className="proxmox-form-group">

                  <label>
                    Adresse IP
                  </label>

                  <input
                    type="text"
                    name="ip"
                    value={form.ip}
                    onChange={
                      handleFormChange
                    }
                    placeholder="192.168.100.101/24"
                  />

                </div>

                {/* BRIDGE */}

                <div className="proxmox-form-group">

                  <label>
                    Bridge réseau
                  </label>

                  <input
                    type="text"
                    name="bridge"
                    value={form.bridge}
                    onChange={
                      handleFormChange
                    }
                    placeholder="vmbr0"
                  />

                </div>

                {/* VLAN */}

                <div className="proxmox-form-group">

                  <label>
                    VLAN
                  </label>

                  <input
                    type="number"
                    name="vlan"
                    value={form.vlan}
                    onChange={
                      handleFormChange
                    }
                    placeholder="Optionnel"
                    min="1"
                    max="4094"
                  />

                </div>

              </div>

              {/* =================================================
                  VM CONFIGURATION
              ================================================= */}

              {resourceType === "vm" && (
                <>
                  <div className="proxmox-section-title">
                    Configuration QEMU
                  </div>

                  <div className="proxmox-form-group">

                    <label>
                      Image ISO
                    </label>

                    <select
                      name="iso"
                      value={form.iso}
                      onChange={
                        handleFormChange
                      }
                      required
                      disabled={
                        loadingIsos
                      }
                    >

                      <option value="">
                        {loadingIsos
                          ? "Chargement des ISO..."
                          : "Sélectionner une image ISO"}
                      </option>

                      {isos.map(
                        (
                          iso,
                          index
                        ) => {

                          const value =
                            iso.volid ||
                            iso.volume ||
                            iso.path ||
                            "";

                          const label =
                            iso.name ||
                            iso.volid ||
                            iso.volume ||
                            iso.path ||
                            `ISO ${index + 1}`;

                          return (
                            <option
                              key={
                                value ||
                                index
                              }
                              value={
                                value
                              }
                            >
                              {label}
                            </option>
                          );
                        }
                      )}

                    </select>

                    {!loadingIsos &&
                      isos.length ===
                        0 && (
                        <small>
                          Aucune image ISO
                          disponible sur
                          Proxmox.
                        </small>
                      )}

                  </div>
                </>
              )}

              {/* =================================================
                  LXC CONFIGURATION
              ================================================= */}

              {resourceType === "lxc" && (
                <>
                  <div className="proxmox-section-title">
                    Configuration LXC
                  </div>

                  <div className="proxmox-form-grid">

                    {/* TEMPLATE */}

                    <div className="proxmox-form-group">

                      <label>
                        Template
                      </label>

                      <input
                        type="text"
                        name="ostemplate"
                        value={
                          form.ostemplate
                        }
                        onChange={
                          handleFormChange
                        }
                        placeholder="local:vztmpl/ubuntu-24.04-standard.tar.zst"
                        required
                      />

                    </div>

                    {/* GATEWAY */}

                    <div className="proxmox-form-group">

                      <label>
                        Gateway
                      </label>

                      <input
                        type="text"
                        name="gateway"
                        value={
                          form.gateway
                        }
                        onChange={
                          handleFormChange
                        }
                        placeholder="192.168.100.1"
                      />

                    </div>

                    {/* PASSWORD */}

                    <div className="proxmox-form-group full">

                      <label>
                        Mot de passe root
                      </label>

                      <input
                        type="password"
                        name="password"
                        value={
                          form.password
                        }
                        onChange={
                          handleFormChange
                        }
                        placeholder="Mot de passe du conteneur"
                        required
                      />

                    </div>

                  </div>

                  <div className="error-banner">

                    <AlertCircle
                      size={17}
                    />

                    <span>
                      La création LXC
                      nécessite encore
                      un endpoint Django
                      dédié.
                    </span>

                  </div>

                </>
              )}

              {/* =================================================
                  CONFIGURATION PREVIEW
              ================================================= */}

              <div className="proxmox-section-title">
                Aperçu configuration
              </div>

              <div className="proxmox-config-preview">

                <div className="proxmox-config-preview-header">

                  Type :{" "}

                  {resourceType ===
                  "vm"
                    ? "QEMU"
                    : "LXC"}

                </div>

                <pre>
{JSON.stringify(
  {
    type: resourceType,

    vmid:
      form.vmid || null,

    name:
      form.name || null,

    cores:
      Number(form.cores),

    memory:
      Number(form.memory),

    disk:
      Number(form.disk),

    ip:
      form.ip || null,

    bridge:
      form.bridge || null,

    vlan:
      form.vlan
        ? Number(form.vlan)
        : null,

    ...(resourceType ===
    "vm"
      ? {
          iso:
            form.iso ||
            null,
        }
      : {
          ostemplate:
            form.ostemplate ||
            null,

          gateway:
            form.gateway ||
            null,
        }),
  },
  null,
  2
)}
                </pre>

              </div>

              {/* =================================================
                  MODAL FOOTER
              ================================================= */}

              <div className="proxmox-modal-footer">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeModal
                  }
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    resourceType ===
                      "vm" &&
                    loadingIsos
                  }
                >

                  <Plus size={17} />

                  Créer{" "}

                  {resourceType ===
                  "vm"
                    ? "la VM"
                    : "le LXC"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Proxmox;