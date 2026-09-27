import { useEffect, useState } from "react";
import {
  Network,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Cable,
  X,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { apiFetch } from "../api";

function OVS() {
  const [bridges, setBridges] = useState([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [showPortModal, setShowPortModal] = useState(false);

  const [selectedBridge, setSelectedBridge] = useState(null);
  const [expandedBridge, setExpandedBridge] = useState(null);

  const [bridgeName, setBridgeName] = useState("");
  const [portName, setPortName] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const loadOVS = async () => {
    try {
      setError("");

      const response = await apiFetch(
        "/network/ovs/"
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de récupérer l'état d'Open vSwitch."
        );
      }

      const data = await response.json();

      setVersion(data.version || "");
      setBridges(data.bridges || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOVS();

    const interval = setInterval(loadOVS, 5000);

    return () => clearInterval(interval);
  }, []);

  const createBridge = async () => {
    if (!bridgeName.trim()) {
      setError("Le nom du bridge est obligatoire.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const response = await apiFetch(
        "/network/ovs/bridges/create/",
        {
          method: "POST",
          body: JSON.stringify({
            name: bridgeName.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Impossible de créer le bridge."
        );
      }

      setBridgeName("");
      setShowBridgeModal(false);

      await loadOVS();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteBridge = async (bridge) => {
    const confirmed = window.confirm(
      `Supprimer le bridge "${bridge}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await apiFetch(
        `/network/ovs/bridges/${encodeURIComponent(
          bridge
        )}/`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Impossible de supprimer le bridge."
        );
      }

      await loadOVS();
    } catch (err) {
      setError(err.message);
    }
  };

  const openPortModal = (bridge) => {
    setSelectedBridge(bridge);
    setPortName("");
    setShowPortModal(true);
    setError("");
  };

  const addPort = async () => {
    if (!portName.trim()) {
      setError("Le nom du port est obligatoire.");
      return;
    }

    if (!selectedBridge) {
      setError("Aucun bridge sélectionné.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const response = await apiFetch(
        "/network/ovs/ports/create/",
        {
          method: "POST",
          body: JSON.stringify({
            bridge: selectedBridge,
            port: portName.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Impossible d'ajouter le port."
        );
      }

      setPortName("");
      setShowPortModal(false);

      await loadOVS();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deletePort = async (bridge, port) => {
    const confirmed = window.confirm(
      `Supprimer le port "${port}" du bridge "${bridge}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await apiFetch(
        `/network/ovs/bridges/${encodeURIComponent(
          bridge
        )}/ports/${encodeURIComponent(port)}/`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Impossible de supprimer le port."
        );
      }

      await loadOVS();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleBridge = (bridge) => {
    setExpandedBridge(
      expandedBridge === bridge ? null : bridge
    );
  };

  const bridgeCommand = bridgeName.trim()
    ? `ovs-vsctl add-br ${bridgeName.trim()}`
    : "ovs-vsctl add-br <bridge>";

  const portCommand =
    selectedBridge && portName.trim()
      ? `ovs-vsctl add-port ${selectedBridge} ${portName.trim()}`
      : "ovs-vsctl add-port <bridge> <port>";

  const totalPorts = bridges.reduce(
    (total, bridge) => total + bridge.ports.length,
    0
  );

  return (
    <div className="module-page ovs-page">
      <div className="page-header">
        <div>
          <div className="page-kicker">
            NETWORK / VIRTUAL SWITCHING
          </div>

          <h1>Open vSwitch</h1>

          <p>
            Gestion des bridges, ports et topologie réseau
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadOVS}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="module-error">
          <span>{error}</span>

          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="ovs-summary">
        <div className="summary-card">
          <div className="summary-icon">
            <Network size={21} />
          </div>

          <div>
            <span>Bridges</span>
            <strong>{bridges.length}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Cable size={21} />
          </div>

          <div>
            <span>Ports</span>
            <strong>{totalPorts}</strong>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Server size={21} />
          </div>

          <div>
            <span>État OVS</span>
            <strong className="status-online">
              ONLINE
            </strong>
          </div>
        </div>

        <div className="summary-card ovs-version-card">
          <div className="summary-icon">
            <Terminal size={21} />
          </div>

          <div>
            <span>Version</span>
            <strong>
              {version
                ? version.split("\n")[0].replace(
                    "ovs-vsctl (Open vSwitch) ",
                    ""
                  )
                : "—"}
            </strong>
          </div>
        </div>
      </div>

      <div className="ovs-toolbar">
        <div>
          <h2>Bridges réseau</h2>
          <p>
            Configuration actuelle d'Open vSwitch
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setBridgeName("");
            setShowBridgeModal(true);
          }}
        >
          <Plus size={17} />
          Créer un bridge
        </button>
      </div>

      {loading && bridges.length === 0 ? (
        <div className="empty-state">
          <RefreshCw size={24} className="spin" />
          <span>Chargement d'Open vSwitch...</span>
        </div>
      ) : bridges.length === 0 ? (
        <div className="empty-state ovs-empty">
          <Network size={38} />

          <h3>Aucun bridge configuré</h3>

          <p>
            Open vSwitch fonctionne correctement, mais
            aucun bridge n'est actuellement configuré.
          </p>

          <button
            className="primary-button"
            onClick={() => {
              setBridgeName("");
              setShowBridgeModal(true);
            }}
          >
            <Plus size={17} />
            Créer le premier bridge
          </button>
        </div>
      ) : (
        <div className="ovs-grid">
          {bridges.map((bridge) => {
            const isExpanded =
              expandedBridge === bridge.name;

            return (
              <div
                className="ovs-bridge-card"
                key={bridge.name}
              >
                <div className="ovs-bridge-header">
                  <div className="ovs-bridge-title">
                    <div className="bridge-icon">
                      <Network size={20} />
                    </div>

                    <div>
                      <h3>{bridge.name}</h3>

                      <span>
                        {bridge.ports.length} port
                        {bridge.ports.length !== 1
                          ? "s"
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="bridge-status">
                    <span className="status-dot" />
                    UP
                  </div>
                </div>

                <div className="ovs-bridge-info">
                  <div>
                    <span>TYPE</span>
                    <strong>OVS Bridge</strong>
                  </div>

                  <div>
                    <span>PORTS</span>
                    <strong>
                      {bridge.ports.length}
                    </strong>
                  </div>
                </div>

                <button
                  className="ports-toggle"
                  onClick={() =>
                    toggleBridge(bridge.name)
                  }
                >
                  <span>
                    {isExpanded
                      ? "Masquer les ports"
                      : "Afficher les ports"}
                  </span>

                  {isExpanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                {isExpanded && (
                  <div className="ovs-port-list">
                    {bridge.ports.length === 0 ? (
                      <div className="no-ports">
                        Aucun port attaché
                      </div>
                    ) : (
                      bridge.ports.map((port) => (
                        <div
                          className="ovs-port-row"
                          key={port}
                        >
                          <div className="port-name">
                            <Cable size={15} />
                            <span>{port}</span>
                          </div>

                          <button
                            className="icon-danger-button"
                            title="Supprimer le port"
                            onClick={() =>
                              deletePort(
                                bridge.name,
                                port
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="ovs-card-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      openPortModal(bridge.name)
                    }
                  >
                    <Plus size={15} />
                    Ajouter un port
                  </button>

                  <button
                    className="danger-button"
                    onClick={() =>
                      deleteBridge(bridge.name)
                    }
                  >
                    <Trash2 size={15} />
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showBridgeModal && (
        <div
          className="ovs-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowBridgeModal(false);
            }
          }}
        >
          <div className="ovs-modal">
            <div className="ovs-modal-header">
              <div>
                <span>OPEN VSWITCH</span>
                <h2>Créer un bridge</h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowBridgeModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="ovs-form">
              <label>
                Nom du bridge
                <input
                  type="text"
                  value={bridgeName}
                  onChange={(event) =>
                    setBridgeName(event.target.value)
                  }
                  placeholder="br0"
                  autoFocus
                />
              </label>

              <div className="command-preview">
                <div className="command-preview-header">
                  <span>
                    <Terminal size={14} />
                    Commande générée
                  </span>
                </div>

                <code>{bridgeCommand}</code>
              </div>
            </div>

            <div className="ovs-modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setShowBridgeModal(false)
                }
              >
                Annuler
              </button>

              <button
                className="primary-button"
                onClick={createBridge}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="spin"
                    />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Créer le bridge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPortModal && (
        <div
          className="ovs-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPortModal(false);
            }
          }}
        >
          <div className="ovs-modal">
            <div className="ovs-modal-header">
              <div>
                <span>
                  BRIDGE / {selectedBridge}
                </span>

                <h2>Ajouter un port</h2>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowPortModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="ovs-form">
              <label>
                Bridge
                <input
                  type="text"
                  value={selectedBridge || ""}
                  disabled
                />
              </label>

              <label>
                Nom du port
                <input
                  type="text"
                  value={portName}
                  onChange={(event) =>
                    setPortName(event.target.value)
                  }
                  placeholder="eth0"
                  autoFocus
                />
              </label>

              <div className="command-preview">
                <div className="command-preview-header">
                  <span>
                    <Terminal size={14} />
                    Commande générée
                  </span>
                </div>

                <code>{portCommand}</code>
              </div>

              <div className="form-warning">
                <strong>Attention :</strong> l'ajout d'une
                interface physique à un bridge peut modifier
                la connectivité réseau de la machine.
              </div>
            </div>

            <div className="ovs-modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setShowPortModal(false)
                }
              >
                Annuler
              </button>

              <button
                className="primary-button"
                onClick={addPort}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="spin"
                    />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Ajouter le port
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OVS;