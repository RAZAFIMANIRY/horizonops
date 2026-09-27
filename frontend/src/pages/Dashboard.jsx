import { useEffect, useMemo, useState } from "react";
import {
  Server,
  Container,
  ShieldCheck,
  Activity,
  Cpu,
  MemoryStick,
  Network,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

import { apiFetch } from "../api";

const REFRESH_INTERVAL = 5000;

/*
 * ============================================================
 * CARTE DE MÉTRIQUE
 * ============================================================
 */

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  detail,
}) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-icon">
          <Icon size={19} />
        </div>

        <span>{label}</span>
      </div>

      <div className="metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>

      <div className="metric-detail">
        {detail}
      </div>
    </div>
  );
}

/*
 * ============================================================
 * CARTE DE SERVICE
 * ============================================================
 */

function ServiceCard({
  icon: Icon,
  name,
  description,
  online,
  detail,
}) {
  return (
    <div className="service-card">
      <div className="service-icon">
        <Icon size={22} />
      </div>

      <div className="service-info">
        <strong>{name}</strong>

        <span>{description}</span>

        {detail && (
          <small>{detail}</small>
        )}
      </div>

      <div
        className={`service-status ${
          online ? "online" : "offline"
        }`}
      >
        {online ? (
          <CheckCircle2 size={16} />
        ) : (
          <XCircle size={16} />
        )}

        {online ? "Online" : "Offline"}
      </div>
    </div>
  );
}

/*
 * ============================================================
 * DASHBOARD
 * ============================================================
 */

function Dashboard() {
  /*
   * ----------------------------------------------------------
   * ÉTATS PROMETHEUS
   * ----------------------------------------------------------
   */

  const [prometheus, setPrometheus] = useState(null);

  const [cpu, setCpu] = useState([]);
  const [memoryUsage, setMemoryUsage] = useState([]);
  const [memorySize, setMemorySize] = useState([]);

  /*
   * ----------------------------------------------------------
   * ÉTATS DOCKER
   * ----------------------------------------------------------
   */

  const [containers, setContainers] = useState([]);
  const [dockerStatus, setDockerStatus] = useState(null);

  /*
   * ----------------------------------------------------------
   * ÉTATS RÉSEAU
   * ----------------------------------------------------------
   */

  const [ovs, setOvs] = useState(null);
  const [wireguard, setWireguard] = useState(null);

  /*
   * ----------------------------------------------------------
   * ÉTATS GÉNÉRAUX
   * ----------------------------------------------------------
   */

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  /*
   * ==========================================================
   * EXTRACTION D'UNE VALEUR PROMETHEUS
   * ==========================================================
   *
   * Les endpoints CPU et mémoire retournent généralement :
   *
   * {
   *   "available": true,
   *   "result": [
   *     {
   *       "metric": {...},
   *       "value": [timestamp, "20.58"]
   *     }
   *   ]
   * }
   *
   * Cette fonction récupère la première valeur valide.
   */

  const getMetricValue = (result = []) => {
    if (
      !Array.isArray(result) ||
      result.length === 0
    ) {
      return null;
    }

    const item = result.find(
      (entry) =>
        Array.isArray(entry?.value) &&
        entry.value.length >= 2
    );

    if (!item) {
      return null;
    }

    const value = Number(
      item.value[1]
    );

    return Number.isFinite(value)
      ? value
      : null;
  };

  /*
   * ==========================================================
   * CHARGEMENT DU DASHBOARD
   * ==========================================================
   */

  const loadDashboard = async (
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      /*
       * ------------------------------------------------------
       * REQUÊTES API
       * ------------------------------------------------------
       */

      const requests = [
        {
          name: "prometheus",
          request: apiFetch(
            "/monitoring/prometheus/"
          ),
        },

        {
          name: "cpu",
          request: apiFetch(
            "/monitoring/prometheus/metrics/cpu/"
          ),
        },

        {
          name: "memory",
          request: apiFetch(
            "/monitoring/prometheus/metrics/memory/"
          ),
        },

        {
          name: "docker-status",
          request: apiFetch(
            "/docker/status/"
          ),
        },

        {
          name: "docker-containers",
          request: apiFetch(
            "/docker/"
          ),
        },

        {
          name: "ovs",
          request: apiFetch(
            "/network/ovs/"
          ),
        },

        {
          name: "wireguard",
          request: apiFetch(
            "/vpn/wireguard/wg0/"
          ),
        },
      ];

      /*
       * ------------------------------------------------------
       * EXÉCUTION DES REQUÊTES
       * ------------------------------------------------------
       */

      const results =
        await Promise.allSettled(
          requests.map(
            ({ request }) => request
          )
        );

      const data = {};

      /*
       * ------------------------------------------------------
       * LECTURE DES RÉPONSES
       * ------------------------------------------------------
       */

      for (
        let index = 0;
        index < results.length;
        index++
      ) {
        const result =
          results[index];

        const name =
          requests[index].name;

        if (
          result.status ===
            "fulfilled" &&
          result.value.ok
        ) {
          try {
            data[name] =
              await result.value.json();
          } catch (jsonError) {
            console.error(
              `Erreur JSON ${name} :`,
              jsonError
            );
          }
        } else {
          console.error(
            `Endpoint ${name} indisponible`
          );
        }
      }

      /*
       * ======================================================
       * PROMETHEUS
       * ======================================================
       */

      if (
        data.prometheus !== undefined
      ) {
        setPrometheus(
          data.prometheus
        );
      }

      /*
       * ======================================================
       * CPU
       * ======================================================
       *
       * IMPORTANT :
       * Le backend retourne déjà le CPU en pourcentage.
       *
       * Exemple :
       * "value": "20.58"
       *
       * Il ne faut donc PAS multiplier par 100.
       */

      if (
        data.cpu !== undefined
      ) {
        console.log(
          "CPU PROMETHEUS :",
          data.cpu
        );

        setCpu(
          Array.isArray(
            data.cpu?.result
          )
            ? data.cpu.result
            : []
        );
      }

      /*
       * ======================================================
       * MÉMOIRE
       * ======================================================
       */

      if (
        data.memory !== undefined
      ) {
        setMemoryUsage(
          Array.isArray(
            data.memory?.usage
          )
            ? data.memory.usage
            : []
        );

        setMemorySize(
          Array.isArray(
            data.memory?.size
          )
            ? data.memory.size
            : []
        );
      }

      /*
       * ======================================================
       * DOCKER
       * ======================================================
       */

      if (
        data["docker-status"] !==
        undefined
      ) {
        setDockerStatus(
          data["docker-status"]
        );
      }

      if (
        data["docker-containers"] !==
        undefined
      ) {
        setContainers(
          Array.isArray(
            data["docker-containers"]
          )
            ? data["docker-containers"]
            : []
        );
      }

      /*
       * ======================================================
       * OPEN VSWITCH
       * ======================================================
       */

      if (
        data.ovs !== undefined
      ) {
        setOvs(data.ovs);
      }

      /*
       * ======================================================
       * WIREGUARD
       * ======================================================
       */

      if (
        data.wireguard !== undefined
      ) {
        setWireguard(
          data.wireguard?.success
            ? data.wireguard.data
            : null
        );
      }

      /*
       * ======================================================
       * ÉTAT GLOBAL DES REQUÊTES
       * ======================================================
       */

      const failedRequests =
        results.filter(
          (result) =>
            result.status ===
              "rejected" ||
            (
              result.status ===
                "fulfilled" &&
              !result.value.ok
            )
        );

      if (
        failedRequests.length > 0
      ) {
        setError(
          `${failedRequests.length} service${
            failedRequests.length > 1
              ? "s"
              : ""
          } n'a pas pu être actualisé.`
        );
      } else {
        setError(null);
      }

      setLastUpdate(
        new Date()
      );
    } catch (err) {
      console.error(
        "Erreur Dashboard :",
        err
      );

      setError(
        "Impossible d'actualiser le Dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
   * ==========================================================
   * ACTUALISATION AUTOMATIQUE
   * ==========================================================
   */

  useEffect(() => {
    loadDashboard();

    const interval =
      setInterval(() => {
        loadDashboard(true);
      }, REFRESH_INTERVAL);

    return () =>
      clearInterval(interval);
  }, []);

  /*
   * ==========================================================
   * ÉTAT PROMETHEUS / PROXMOX
   * ==========================================================
   */

  const prometheusOnline =
    prometheus?.prometheus
      ?.available === true;

  const proxmoxOnline =
    prometheus?.proxmox
      ?.available === true;

  /*
   * ==========================================================
   * CPU
   * ==========================================================
   *
   * Le backend retourne déjà une valeur en %.
   *
   * Exemple :
   * 20.58
   *
   * Donc on affiche :
   * 20.6 %
   *
   * et NON :
   * 2058 %
   */

  const nodeCpu = useMemo(() => {
    return getMetricValue(cpu);
  }, [cpu]);

  /*
   * ==========================================================
   * MÉMOIRE
   * ==========================================================
   */

  const nodeMemoryUsage =
    useMemo(() => {
      return getMetricValue(
        memoryUsage
      );
    }, [memoryUsage]);

  const nodeMemorySize =
    useMemo(() => {
      return getMetricValue(
        memorySize
      );
    }, [memorySize]);

  /*
   * Pour la mémoire, les valeurs sont
   * exprimées en octets.
   */

  const memoryPercent =
    useMemo(() => {
      if (
        nodeMemoryUsage === null ||
        nodeMemorySize === null ||
        nodeMemorySize <= 0
      ) {
        return null;
      }

      return (
        (nodeMemoryUsage /
          nodeMemorySize) *
        100
      );
    }, [
      nodeMemoryUsage,
      nodeMemorySize,
    ]);

  /*
   * ==========================================================
   * DOCKER
   * ==========================================================
   */

  const dockerRunning =
    useMemo(() => {
      return containers.filter(
        (container) =>
          container.status ===
          "running"
      ).length;
    }, [containers]);

  const dockerOnline =
    dockerStatus?.available === true;

  /*
   * ==========================================================
   * OPEN VSWITCH
   * ==========================================================
   */

  const ovsBridges =
    Array.isArray(
      ovs?.bridges
    )
      ? ovs.bridges
      : [];

  const ovsPorts =
    useMemo(() => {
      return ovsBridges.reduce(
        (total, bridge) =>
          total +
          (
            Array.isArray(
              bridge.ports
            )
              ? bridge.ports.length
              : 0
          ),
        0
      );
    }, [ovsBridges]);

  /*
   * ==========================================================
   * WIREGUARD
   * ==========================================================
   */

  const wireguardOnline =
    wireguard?.interface ===
    "wg0";

  const wireguardPeers =
    wireguard?.peers?.length || 0;

  /*
   * ==========================================================
   * ÉTAT GLOBAL DES SERVICES
   * ==========================================================
   */

  const servicesOnline = [
    proxmoxOnline,
    dockerOnline,
    ovs !== null,
    wireguardOnline,
    prometheusOnline,
  ].filter(Boolean).length;

  const allServicesOnline =
    servicesOnline === 5;

  /*
   * ==========================================================
   * CHARGEMENT INITIAL
   * ==========================================================
   */

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-state">
          <RefreshCw
            size={25}
            className="spin"
          />

          <span>
            Chargement de
            l'infrastructure...
          </span>
        </div>
      </div>
    );
  }

  /*
   * ==========================================================
   * RENDU
   * ==========================================================
   */

  return (
    <div className="dashboard">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="page-heading">

        <div>
          <span className="eyebrow">
            INFRASTRUCTURE OVERVIEW
          </span>

          <h1>
            Command Center
          </h1>

          <p>
            Vue centralisée de votre
            infrastructure cloud.
          </p>
        </div>

        <div className="dashboard-header-actions">

          <div className="refresh-status">

            <span
              className={`status-dot ${
                allServicesOnline
                  ? ""
                  : "status-warning"
              }`}
            />

            Metrics live · 5s

          </div>

          <button
            className="secondary-button"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "spin"
                  : ""
              }
            />

            Actualiser

          </button>

        </div>

      </div>

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="module-error dashboard-error">
          <span>
            {error}
          </span>
        </div>
      )}

      {/* ====================================================
          MÉTRIQUES
      ==================================================== */}

      <section className="metrics-grid">

        {/* CPU PROXMOX */}

        <MetricCard
          label="CPU Proxmox"
          value={
            proxmoxOnline &&
            nodeCpu !== null
              ? nodeCpu.toFixed(1)
              : "—"
          }
          unit={
            proxmoxOnline &&
            nodeCpu !== null
              ? "%"
              : ""
          }
          icon={Cpu}
          detail={
            proxmoxOnline
              ? "Utilisation du nœud pve"
              : "Proxmox indisponible"
          }
        />

        {/* MÉMOIRE PROXMOX */}

        <MetricCard
          label="Memory Proxmox"
          value={
            proxmoxOnline &&
            memoryPercent !== null
              ? memoryPercent.toFixed(1)
              : "—"
          }
          unit={
            proxmoxOnline &&
            memoryPercent !== null
              ? "%"
              : ""
          }
          icon={MemoryStick}
          detail={
            proxmoxOnline &&
            nodeMemoryUsage !== null &&
            nodeMemorySize !== null
              ? `${formatBytes(
                  nodeMemoryUsage
                )} / ${formatBytes(
                  nodeMemorySize
                )}`
              : "Données indisponibles"
          }
        />

        {/* DOCKER */}

        <MetricCard
          label="Docker"
          value={
            dockerOnline
              ? containers.length
              : "—"
          }
          unit={
            dockerOnline
              ? " containers"
              : ""
          }
          icon={Container}
          detail={
            dockerOnline
              ? `${dockerRunning} en cours d'exécution`
              : "Docker Engine indisponible"
          }
        />

        {/* OPEN VSWITCH */}

        <MetricCard
          label="Open vSwitch"
          value={
            ovs !== null
              ? ovsBridges.length
              : "—"
          }
          unit={
            ovs !== null
              ? (
                  ovsBridges.length ===
                  1
                    ? " bridge"
                    : " bridges"
                )
              : ""
          }
          icon={Network}
          detail={
            ovs !== null
              ? `${ovsPorts} port${
                  ovsPorts !== 1
                    ? "s"
                    : ""
                } configuré${
                  ovsPorts !== 1
                    ? "s"
                    : ""
                }`
              : "Open vSwitch indisponible"
          }
        />

      </section>

      {/* ====================================================
          SERVICE OVERVIEW
      ==================================================== */}

      <section className="section-block">

        <div className="section-title">

          <div>
            <span className="eyebrow">
              INFRASTRUCTURE
            </span>

            <h2>
              Service Overview
            </h2>
          </div>

          <span className="healthy-label">
            {servicesOnline}/5 services
          </span>

        </div>

        <div className="service-grid">

          {/* PROXMOX */}

          <ServiceCard
            icon={Server}
            name="Proxmox VE"
            description="VM & LXC infrastructure"
            online={proxmoxOnline}
            detail="Nœud pve"
          />

          {/* DOCKER */}

          <ServiceCard
            icon={Container}
            name="Docker"
            description="Container runtime"
            online={dockerOnline}
            detail={
              dockerOnline
                ? `${containers.length} container${
                    containers.length !==
                    1
                      ? "s"
                      : ""
                  }`
                : "Engine indisponible"
            }
          />

          {/* OPEN VSWITCH */}

          <ServiceCard
            icon={Network}
            name="Open vSwitch"
            description="Virtual networking"
            online={
              ovs !== null
            }
            detail={
              ovs !== null
                ? `${ovsBridges.length} bridge${
                    ovsBridges.length !==
                    1
                      ? "s"
                      : ""
                  }`
                : "Service indisponible"
            }
          />

          {/* WIREGUARD */}

          <ServiceCard
            icon={ShieldCheck}
            name="WireGuard"
            description="VPN infrastructure"
            online={
              wireguardOnline
            }
            detail={`${wireguardPeers} peer${
              wireguardPeers !==
              1
                ? "s"
                : ""
            }`}
          />

          {/* PROMETHEUS */}

          <ServiceCard
            icon={Activity}
            name="Prometheus"
            description="Infrastructure monitoring"
            online={
              prometheusOnline
            }
            detail="Monitoring"
          />

        </div>

      </section>

      {/* ====================================================
          SYSTEM HEALTH
      ==================================================== */}

      <section className="section-block">

        <div className="section-title">

          <div>
            <span className="eyebrow">
              SYSTEM HEALTH
            </span>

            <h2>
              Infrastructure Status
            </h2>
          </div>

          <span
            className={`healthy-label ${
              allServicesOnline
                ? ""
                : "warning"
            }`}
          >
            {allServicesOnline
              ? "All systems operational"
              : `${servicesOnline}/5 services opérationnels`}
          </span>

        </div>

        <div className="health-panel">

          {/* PROXMOX */}

          <div className="health-row">

            <span>
              Proxmox Node
            </span>

            <span
              className={
                proxmoxOnline
                  ? "health-online"
                  : "health-offline"
              }
            >
              {proxmoxOnline
                ? "● Online"
                : "● Offline"}
            </span>

          </div>

          {/* DOCKER */}

          <div className="health-row">

            <span>
              Docker Engine
            </span>

            <span
              className={
                dockerOnline
                  ? "health-online"
                  : "health-offline"
              }
            >
              {dockerOnline
                ? "● Online"
                : "● Offline"}
            </span>

          </div>

          {/* OPEN VSWITCH */}

          <div className="health-row">

            <span>
              Open vSwitch
            </span>

            <span
              className={
                ovs !== null
                  ? "health-online"
                  : "health-offline"
              }
            >
              {ovs !== null
                ? "● Online"
                : "● Offline"}
            </span>

          </div>

          {/* WIREGUARD */}

          <div className="health-row">

            <span>
              WireGuard
            </span>

            <span
              className={
                wireguardOnline
                  ? "health-online"
                  : "health-offline"
              }
            >
              {wireguardOnline
                ? "● Online"
                : "● Offline"}
            </span>

          </div>

          {/* PROMETHEUS */}

          <div className="health-row">

            <span>
              Prometheus
            </span>

            <span
              className={
                prometheusOnline
                  ? "health-online"
                  : "health-offline"
              }
            >
              {prometheusOnline
                ? "● Online"
                : "● Offline"}
            </span>

          </div>

        </div>

      </section>

      {/* ====================================================
          FOOTER
      ==================================================== */}

      <div className="dashboard-footer">

        <div>

          <span
            className={`status-dot ${
              allServicesOnline
                ? ""
                : "status-warning"
            }`}
          />

          Actualisation automatique
          toutes les 5 secondes

        </div>

        <div>

          Dernière mise à jour :{" "}

          {lastUpdate
            ? lastUpdate.toLocaleTimeString(
                "fr-FR"
              )
            : "—"}

        </div>

      </div>

    </div>
  );
}

/*
 * ============================================================
 * UTILITAIRE : FORMATAGE DES OCTETS
 * ============================================================
 */

function formatBytes(
  bytes,
  decimals = 1
) {
  if (
    bytes === null ||
    bytes === undefined ||
    !Number.isFinite(
      Number(bytes)
    )
  ) {
    return "—";
  }

  const value = Number(bytes);

  if (value === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(value) /
        Math.log(1024)
    ),
    units.length - 1
  );

  return `${(
    value /
    Math.pow(
      1024,
      index
    )
  ).toFixed(decimals)} ${
    units[index]
  }`;
}

export default Dashboard;