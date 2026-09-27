import { useEffect, useState } from "react";
import {
  Container,
  Plus,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  X,
  Terminal,
  Cpu,
  MemoryStick,
  Network,
  Hash,
} from "lucide-react";

import { apiFetch } from "../api";

function Docker() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    name: "",
    image: "",
    ports: "",
    network: "",
    command: "",
  });

  /*
   * ----------------------------------------------------
   * RÉCUPÉRATION DES CONTAINERS
   * ----------------------------------------------------
   */

  const loadContainers = async () => {
    try {
      setLoading(true);

      const response = await apiFetch("/docker/");

      if (!response.ok) {
        throw new Error(
          "Impossible de récupérer les containers."
        );
      }

      const data = await response.json();

      setContainers(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Erreur récupération Docker :",
        error
      );

      setContainers([]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * ----------------------------------------------------
   * CHARGEMENT AUTOMATIQUE
   * ----------------------------------------------------
   */

  useEffect(() => {
    loadContainers();

    const interval = setInterval(
      loadContainers,
      5000
    );

    return () =>
      clearInterval(interval);
  }, []);

  /*
   * ----------------------------------------------------
   * ACTION CONTAINER
   * ----------------------------------------------------
   */

  const executeAction = async (
    containerId,
    action
  ) => {
    try {
      setActionLoading(
        `${containerId}-${action}`
      );

      const response = await apiFetch(
        `/docker/${containerId}/${action}/`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          data.error ||
            `Impossible d'effectuer l'action ${action}.`
        );
      }

      await loadContainers();
    } catch (error) {
      console.error(
        `Erreur Docker ${action} :`,
        error
      );

      alert(
        error.message ||
          `Impossible d'effectuer l'action ${action}.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ----------------------------------------------------
   * FORMULAIRE
   * ----------------------------------------------------
   */

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /*
   * ----------------------------------------------------
   * CRÉATION CONTAINER
   * ----------------------------------------------------
   */

  const createContainer = async (
    event
  ) => {
    event.preventDefault();

    try {
      const ports = {};

      if (form.ports.trim()) {
        const portEntries =
          form.ports.split(",");

        portEntries.forEach(
          (entry) => {
            const [
              hostPort,
              containerPort,
            ] = entry
              .trim()
              .split(":");

            if (
              hostPort &&
              containerPort
            ) {
              ports[
                `${containerPort}/tcp`
              ] = [
                {
                  HostPort:
                    hostPort,
                },
              ];
            }
          }
        );
      }

      const response =
        await apiFetch(
          "/docker/create/",
          {
            method: "POST",
            body: JSON.stringify({
              name: form.name,
              image: form.image,
              ports,
              network: form.network,
              command: form.command,
            }),
          }
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          data.error ||
            "Impossible de créer le container."
        );
      }

      setForm({
        name: "",
        image: "",
        ports: "",
        network: "",
        command: "",
      });

      setShowCreate(false);

      await loadContainers();
    } catch (error) {
      console.error(
        "Erreur création container :",
        error
      );

      alert(
        error.message ||
          "Impossible de créer le container."
      );
    }
  };

  /*
   * ----------------------------------------------------
   * GÉNÉRATION COMMANDE DOCKER
   * ----------------------------------------------------
   */

  const buildDockerCommand = () => {
    let command =
      "docker run -d";

    if (form.name) {
      command += ` \\\n  --name ${form.name}`;
    }

    if (form.ports) {
      form.ports
        .split(",")
        .map((port) =>
          port.trim()
        )
        .filter(Boolean)
        .forEach((port) => {
          command += ` \\\n  -p ${port}`;
        });
    }

    if (form.network) {
      command += ` \\\n  --network ${form.network}`;
    }

    if (form.image) {
      command += ` \\\n  ${form.image}`;
    } else {
      command +=
        " \\\n  <image>";
    }

    if (form.command) {
      command += ` \\\n  ${form.command}`;
    }

    return command;
  };

  /*
   * ----------------------------------------------------
   * FORMATAGE DES PORTS
   * ----------------------------------------------------
   */

  const formatPorts = (ports) => {
    if (!ports) {
      return "—";
    }

    /*
     * Format retourné actuellement
     *
     * [
     *   "0.0.0.0:9090->9090/tcp",
     *   ":::9090->9090/tcp"
     * ]
     */

    if (Array.isArray(ports)) {
      return ports.length
        ? ports.join(", ")
        : "—";
    }

    /*
     * Compatibilité avec le format
     * natif Docker
     */

    if (
      typeof ports === "object" &&
      ports !== null
    ) {
      const result = [];

      Object.entries(
        ports
      ).forEach(
        ([
          containerPort,
          bindings,
        ]) => {
          if (!bindings) {
            result.push(
              containerPort
            );

            return;
          }

          if (
            Array.isArray(
              bindings
            )
          ) {
            bindings.forEach(
              (binding) => {
                if (!binding) {
                  return;
                }

                result.push(
                  `${
                    binding.HostIp ||
                    "0.0.0.0"
                  }:${
                    binding.HostPort ||
                    "?"
                  }->${containerPort.replace(
                    "/tcp",
                    ""
                  )}`
                );
              }
            );

            return;
          }

          result.push(
            `${bindings}->${containerPort.replace(
              "/tcp",
              ""
            )}`
          );
        }
      );

      return result.length
        ? result.join(", ")
        : "—";
    }

    return "—";
  };

  /*
   * ----------------------------------------------------
   * CLASSE STATUS
   * ----------------------------------------------------
   */

  const getStatusClass = (
    status
  ) => {
    if (
      status === "running"
    ) {
      return "status-running";
    }

    if (
      status === "exited" ||
      status === "created"
    ) {
      return "status-stopped";
    }

    return "status-warning";
  };

  /*
   * ----------------------------------------------------
   * INTERFACE
   * ----------------------------------------------------
   */

  return (
    <div className="module-page">

      {/* ============================================
          HEADER
      ============================================ */}

      <div className="page-header">

        <div>
          <span className="breadcrumb">
            DOCKER / CONTAINERS
          </span>

          <h1>
            Docker
          </h1>

          <p>
            Gestion et supervision
            des containers Docker.
          </p>
        </div>

        <div className="page-actions">

          <button
            className="secondary-button"
            onClick={
              loadContainers
            }
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "spin"
                  : ""
              }
            />

            Actualiser
          </button>

          <button
            className="primary-button"
            onClick={() =>
              setShowCreate(true)
            }
          >
            <Plus size={17} />

            Créer un container
          </button>

        </div>

      </div>

      {/* ============================================
          SUMMARY
      ============================================ */}

      <div className="docker-summary">

        <div className="summary-card">

          <div className="summary-icon">
            <Container
              size={20}
            />
          </div>

          <div>
            <span>
              Total containers
            </span>

            <strong>
              {containers.length}
            </strong>
          </div>

        </div>

        <div className="summary-card">

          <div className="summary-icon">
            <Play size={20} />
          </div>

          <div>
            <span>
              Running
            </span>

            <strong>
              {
                containers.filter(
                  (container) =>
                    container.status ===
                    "running"
                ).length
              }
            </strong>
          </div>

        </div>

        <div className="summary-card">

          <div className="summary-icon">
            <Square
              size={20}
            />
          </div>

          <div>
            <span>
              Stopped
            </span>

            <strong>
              {
                containers.filter(
                  (container) =>
                    container.status !==
                    "running"
                ).length
              }
            </strong>
          </div>

        </div>

      </div>

      {/* ============================================
          CONTAINERS
      ============================================ */}

      {loading &&
      containers.length === 0 ? (
        <div className="loading-state">

          <RefreshCw
            size={24}
            className="spin"
          />

          <span>
            Connexion à Docker...
          </span>

        </div>
      ) : containers.length ===
        0 ? (
        <div className="empty-state">

          <Container
            size={42}
          />

          <h3>
            Aucun container
          </h3>

          <p>
            Aucun container Docker
            n'est actuellement
            disponible.
          </p>

          <button
            className="primary-button"
            onClick={() =>
              setShowCreate(true)
            }
          >
            <Plus size={17} />

            Créer un container
          </button>

        </div>
      ) : (
        <div className="docker-grid">

          {containers.map(
            (container) => (
              <div
                className="docker-card"
                key={container.id}
              >

                {/* HEADER */}

                <div className="docker-card-header">

                  <div className="docker-title">

                    <div className="docker-icon">
                      <Container
                        size={21}
                      />
                    </div>

                    <div>

                      <h3>
                        {
                          container.name
                        }
                      </h3>

                      <span>
                        {
                          container.image
                        }
                      </span>

                    </div>

                  </div>

                  <span
                    className={`container-status ${getStatusClass(
                      container.status
                    )}`}
                  >
                    <span />

                    {
                      container.status
                    }
                  </span>

                </div>

                {/* INFORMATIONS */}

                <div className="docker-info-grid">

                  <div className="docker-info">

                    <Cpu size={16} />

                    <div>
                      <span>
                        CPU
                      </span>

                      <strong>
                        {Number(
                          container.cpu ||
                            0
                        ).toFixed(2)}
                        %
                      </strong>
                    </div>

                  </div>

                  <div className="docker-info">

                    <MemoryStick
                      size={16}
                    />

                    <div>
                      <span>
                        Memory
                      </span>

                      <strong>
                        {Number(
                          container.memory ||
                            0
                        ).toFixed(2)}
                        %
                      </strong>
                    </div>

                  </div>

                  <div className="docker-info">

                    <Network
                      size={16}
                    />

                    <div>
                      <span>
                        Network
                      </span>

                      <strong>
                        {container
                          .networks
                          ?.join(
                            ", "
                          ) ||
                          "—"}
                      </strong>
                    </div>

                  </div>

                  <div className="docker-info">

                    <Hash size={16} />

                    <div>
                      <span>
                        Restart
                      </span>

                      <strong>
                        {
                          container.restart_count ??
                          0
                        }
                      </strong>
                    </div>

                  </div>

                </div>

                {/* PORTS */}

                <div className="docker-detail-row">

                  <span>
                    Ports
                  </span>

                  <code>
                    {formatPorts(
                      container.ports
                    )}
                  </code>

                </div>

                {/* ACTIONS */}

                <div className="docker-actions">

                  <button
                    className="action-button start"
                    disabled={
                      container.status ===
                        "running" ||
                      actionLoading !==
                        null
                    }
                    onClick={() =>
                      executeAction(
                        container.id,
                        "start"
                      )
                    }
                  >
                    <Play size={15} />

                    Start
                  </button>

                  <button
                    className="action-button restart"
                    disabled={
                      actionLoading !==
                      null
                    }
                    onClick={() =>
                      executeAction(
                        container.id,
                        "restart"
                      )
                    }
                  >
                    <RotateCcw
                      size={15}
                    />

                    Restart
                  </button>

                  <button
                    className="action-button stop"
                    disabled={
                      container.status !==
                        "running" ||
                      actionLoading !==
                        null
                    }
                    onClick={() =>
                      executeAction(
                        container.id,
                        "stop"
                      )
                    }
                  >
                    <Square size={15} />

                    Stop
                  </button>

                </div>

              </div>
            )
          )}

        </div>
      )}

      {/* ============================================
          MODAL CRÉATION
      ============================================ */}

      {showCreate && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowCreate(false)
          }
        >

          <div
            className="docker-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="breadcrumb">
                  DOCKER / CREATE
                </span>

                <h2>
                  Créer un container
                </h2>

              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowCreate(false)
                }
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={
                createContainer
              }
            >

              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Nom du container
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={
                      form.name
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="web-server"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Image
                  </label>

                  <input
                    type="text"
                    name="image"
                    value={
                      form.image
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="nginx:latest"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Ports
                  </label>

                  <input
                    type="text"
                    name="ports"
                    value={
                      form.ports
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="8080:80,8443:443"
                  />

                  <small>
                    Format :
                    port_hôte:port_container
                  </small>

                </div>

                <div className="form-group">

                  <label>
                    Network
                  </label>

                  <input
                    type="text"
                    name="network"
                    value={
                      form.network
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="bridge"
                  />

                </div>

              </div>

              <div className="form-group">

                <label>
                  Commande
                </label>

                <input
                  type="text"
                  name="command"
                  value={
                    form.command
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ex: nginx -g 'daemon off;'"
                />

              </div>

              {/* COMMAND PREVIEW */}

              <div className="command-preview">

                <div className="command-header">

                  <span>
                    <Terminal
                      size={15}
                    />

                    Docker command
                  </span>

                </div>

                <pre>
                  {
                    buildDockerCommand()
                  }
                </pre>

              </div>

              {/* MODAL ACTIONS */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowCreate(
                      false
                    )
                  }
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  <Plus size={17} />

                  Créer le container
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Docker;