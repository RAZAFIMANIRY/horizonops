import { useEffect, useState } from "react";
import {
  Shield,
  RefreshCw,
  Power,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch } from "../api";

export default function WireGuard() {
  const [wireguard, setWireguard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [peer, setPeer] = useState({
    public_key: "",
    allowed_ips: "10.10.0.2/32",
    endpoint: "",
    persistent_keepalive: "25",
  });

  // --------------------------------------------------
  // RÉCUPÉRER L'ÉTAT DE WG0
  // --------------------------------------------------

  const loadWireGuard = async () => {
    try {
      setError("");

      const response = await apiFetch(
        "/vpn/wireguard/wg0/"
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de contacter le serveur WireGuard."
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error || "Erreur WireGuard."
        );
      }

      setWireguard(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // CHARGEMENT INITIAL + ACTUALISATION
  // --------------------------------------------------

  useEffect(() => {
    loadWireGuard();

    const timer = setInterval(() => {
      loadWireGuard();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------
  // ACTIVER / DÉSACTIVER WG0
  // --------------------------------------------------

  const changeInterfaceState = async (action) => {
    try {
      setError("");

      const response = await apiFetch(
        `/vpn/wireguard/${action}/`,
        {
          method: "POST",
          body: JSON.stringify({
            interface: "wg0",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            `Impossible d'exécuter ${action}.`
        );
      }

      await loadWireGuard();
    } catch (err) {
      setError(err.message);
    }
  };

  // --------------------------------------------------
  // FORMULAIRE PEER
  // --------------------------------------------------

  const handlePeerChange = (event) => {
    setPeer({
      ...peer,
      [event.target.name]: event.target.value,
    });
  };

  // --------------------------------------------------
  // AJOUTER UN PEER
  // --------------------------------------------------

  const addPeer = async (event) => {
    event.preventDefault();

    try {
      setError("");

      const body = {
        interface: "wg0",
        public_key: peer.public_key.trim(),
        allowed_ips: peer.allowed_ips.trim(),
      };

      if (peer.endpoint.trim() !== "") {
        body.endpoint = peer.endpoint.trim();
      }

      if (peer.persistent_keepalive !== "") {
        body.persistent_keepalive = Number(
          peer.persistent_keepalive
        );
      }

      const response = await apiFetch(
        "/vpn/wireguard/peers/create/",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Impossible d'ajouter le peer."
        );
      }

      setShowModal(false);

      setPeer({
        public_key: "",
        allowed_ips: "10.10.0.2/32",
        endpoint: "",
        persistent_keepalive: "25",
      });

      await loadWireGuard();
    } catch (err) {
      setError(err.message);
    }
  };

  // --------------------------------------------------
  // SUPPRIMER UN PEER
  // --------------------------------------------------

  const deletePeer = async (publicKey) => {
    if (
      !window.confirm(
        "Voulez-vous supprimer ce peer ?"
      )
    ) {
      return;
    }

    try {
      setError("");

      const response = await apiFetch(
        "/vpn/wireguard/peers/delete/",
        {
          method: "DELETE",
          body: JSON.stringify({
            interface: "wg0",
            public_key: publicKey,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Impossible de supprimer le peer."
        );
      }

      await loadWireGuard();
    } catch (err) {
      setError(err.message);
    }
  };

  // --------------------------------------------------
  // CHARGEMENT
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="vpn-page">
        <p>Chargement de WireGuard...</p>
      </div>
    );
  }

  // --------------------------------------------------
  // INTERFACE
  // --------------------------------------------------

  return (
    <div className="vpn-page">

      {/* ============================================
          TITRE
      ============================================ */}

      <div className="vpn-header">

        <div className="vpn-title">

          <Shield size={30} />

          <div>
            <h1>WireGuard VPN</h1>
            <p>
              Gestion du tunnel VPN et des clients
            </p>
          </div>

        </div>

        <button
          onClick={loadWireGuard}
          className="vpn-button"
        >
          <RefreshCw size={17} />
          Actualiser
        </button>

      </div>

      {/* ============================================
          ERREUR
      ============================================ */}

      {error && (
        <div className="vpn-error">
          {error}
        </div>
      )}

      {/* ============================================
          INTERFACE WG0
      ============================================ */}

      <div className="vpn-card">

        <div className="vpn-card-header">

          <div>
            <h2>
              <Shield size={20} />
              {wireguard?.interface || "wg0"}
            </h2>

            <p>
              Interface WireGuard
            </p>
          </div>

          <div className="vpn-state">
            <span className="vpn-dot"></span>
            ACTIF
          </div>

        </div>

        <div className="vpn-information">

          <div>
            <span>Clé publique</span>

            <strong>
              {wireguard?.public_key || "-"}
            </strong>
          </div>

          <div>
            <span>Port d'écoute</span>

            <strong>
              {wireguard?.listen_port || "-"}
            </strong>
          </div>

          <div>
            <span>Nombre de peers</span>

            <strong>
              {wireguard?.peers?.length || 0}
            </strong>
          </div>

        </div>

        <div className="vpn-actions">

          <button
            onClick={() =>
              changeInterfaceState("up")
            }
            className="vpn-button vpn-success"
          >
            <Power size={16} />
            Activer
          </button>

          <button
            onClick={() =>
              changeInterfaceState("down")
            }
            className="vpn-button vpn-danger"
          >
            <Power size={16} />
            Désactiver
          </button>

        </div>

      </div>

      {/* ============================================
          SECTION PEERS
      ============================================ */}

      <div className="vpn-section-header">

        <div>
          <h2>Peers</h2>

          <p>
            Clients autorisés sur le tunnel VPN
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="vpn-button vpn-primary"
        >
          <Plus size={17} />
          Ajouter un peer
        </button>

      </div>

      {/* ============================================
          LISTE DES PEERS
      ============================================ */}

      {wireguard?.peers?.length === 0 ? (

        <div className="vpn-empty">

          <Shield size={35} />

          <h3>Aucun peer</h3>

          <p>
            Aucun client WireGuard n'est actuellement
            configuré.
          </p>

        </div>

      ) : (

        <div className="vpn-peers">

          {wireguard.peers.map((item) => (

            <div
              className="vpn-peer"
              key={item.public_key}
            >

              <div className="vpn-peer-header">

                <div>
                  <h3>Peer WireGuard</h3>

                  <span>
                    {item.latest_handshake
                      ? "Connecté"
                      : "En attente"}
                  </span>
                </div>

                <button
                  onClick={() =>
                    deletePeer(item.public_key)
                  }
                  className="vpn-delete"
                  title="Supprimer"
                >
                  <Trash2 size={17} />
                </button>

              </div>

              <div className="vpn-peer-info">

                <div>
                  <span>Clé publique</span>

                  <code>
                    {item.public_key}
                  </code>
                </div>

                <div>
                  <span>Allowed IPs</span>

                  <strong>
                    {item.allowed_ips?.join(", ") ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Endpoint</span>

                  <strong>
                    {item.endpoint || "Non défini"}
                  </strong>
                </div>

                <div>
                  <span>Dernier handshake</span>

                  <strong>
                    {item.latest_handshake ||
                      "Jamais"}
                  </strong>
                </div>

                <div>
                  <span>Reçu</span>

                  <strong>
                    {item.transfer_rx || "0 B"}
                  </strong>
                </div>

                <div>
                  <span>Envoyé</span>

                  <strong>
                    {item.transfer_tx || "0 B"}
                  </strong>
                </div>

              </div>

            </div>

          ))}

        </div>

      )}

      {/* ============================================
          MODALE AJOUT PEER
      ============================================ */}

      {showModal && (

        <div className="vpn-modal-background">

          <div className="vpn-modal">

            <div className="vpn-modal-header">

              <div>
                <h2>Ajouter un peer</h2>

                <p>
                  Nouveau client WireGuard
                </p>
              </div>

              <button
                onClick={() =>
                  setShowModal(false)
                }
                className="vpn-close"
              >
                <X size={20} />
              </button>

            </div>

            <form onSubmit={addPeer}>

              <div className="vpn-form-group">

                <label>
                  Clé publique du client
                </label>

                <input
                  type="text"
                  name="public_key"
                  value={peer.public_key}
                  onChange={handlePeerChange}
                  placeholder="Clé publique WireGuard"
                  required
                />

              </div>

              <div className="vpn-form-group">

                <label>
                  Allowed IPs
                </label>

                <input
                  type="text"
                  name="allowed_ips"
                  value={peer.allowed_ips}
                  onChange={handlePeerChange}
                  placeholder="10.10.0.2/32"
                  required
                />

              </div>

              <div className="vpn-form-group">

                <label>
                  Endpoint
                </label>

                <input
                  type="text"
                  name="endpoint"
                  value={peer.endpoint}
                  onChange={handlePeerChange}
                  placeholder="IP:51820 (optionnel)"
                />

              </div>

              <div className="vpn-form-group">

                <label>
                  Persistent Keepalive
                </label>

                <input
                  type="number"
                  name="persistent_keepalive"
                  value={
                    peer.persistent_keepalive
                  }
                  onChange={handlePeerChange}
                  min="0"
                  max="65535"
                />

              </div>

              <div className="vpn-modal-actions">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="vpn-button"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="vpn-button vpn-primary"
                >
                  <Plus size={17} />
                  Ajouter
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}