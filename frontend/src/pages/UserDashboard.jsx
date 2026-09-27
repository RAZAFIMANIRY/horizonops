import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Circle,
  Cpu,
  Database,
  HardDrive,
  LogOut,
  MemoryStick,
  RefreshCw,
  Server,
  Wifi,
  XCircle,
} from "lucide-react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./UserDashboard.css";

const API_BASE_URL = "/api";
const REFRESH_INTERVAL = 15000;
const MAX_HISTORY_POINTS = 20;

/* =========================================================
   UTILITAIRES
   ========================================================= */

function formatNumber(value, decimals = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toFixed(decimals);
}

function formatBytes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  let size = number;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatMemoryMB(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "0 MB";
  }

  if (number >= 1024) {
    return `${(number / 1024).toFixed(1)} GB`;
  }

  return `${number.toFixed(0)} MB`;
}

function getTimeLabel(date = new Date()) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();

  if (
    value.includes("running") ||
    value.includes("online") ||
    value.includes("active") ||
    value.includes("up")
  ) {
    return "running";
  }

  if (
    value.includes("stopped") ||
    value.includes("offline") ||
    value.includes("down") ||
    value.includes("inactive")
  ) {
    return "stopped";
  }

  return "unknown";
}

function extractArray(data, keys = []) {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

function findNumericValue(data, possibleKeys = []) {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === "number") {
    return Number.isFinite(data) ? data : null;
  }

  if (typeof data === "string") {
    const number = Number.parseFloat(data);
    return Number.isFinite(number) ? number : null;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const value = findNumericValue(item, possibleKeys);

      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  if (typeof data === "object") {
    for (const key of possibleKeys) {
      if (data[key] !== undefined && data[key] !== null) {
        const value = Number.parseFloat(data[key]);

        if (Number.isFinite(value)) {
          return value;
        }
      }
    }

    for (const key of [
      "value",
      "result",
      "current",
      "usage",
      "percent",
      "percentage",
      "data",
    ]) {
      if (data[key] !== undefined && data[key] !== null) {
        const value = findNumericValue(data[key], possibleKeys);

        if (value !== null) {
          return value;
        }
      }
    }
  }

  return null;
}

function normalizePercentage(value) {
  let number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  /*
   * Certains endpoints retournent une valeur comprise entre
   * 0 et 1, d'autres entre 0 et 100.
   */
  if (number >= 0 && number <= 1) {
    number *= 100;
  }

  return Math.max(0, Math.min(100, number));
}

function normalizeMetricResponse(data, type) {
  if (!data) {
    return 0;
  }

  let value = null;

  if (type === "cpu") {
    value = findNumericValue(data, [
      "cpu",
      "cpu_usage",
      "cpu_percent",
      "cpu_utilization",
      "usage",
      "percentage",
    ]);
  }

  if (type === "memory") {
    value = findNumericValue(data, [
      "memory",
      "memory_usage",
      "memory_percent",
      "memory_percentage",
      "mem",
      "usage",
      "percentage",
    ]);
  }

  if (type === "disk") {
    value = findNumericValue(data, [
      "disk",
      "disk_usage",
      "disk_percent",
      "disk_percentage",
      "storage",
      "storage_usage",
      "usage",
      "percentage",
    ]);
  }

  return normalizePercentage(value ?? 0);
}

function normalizeNetworkResponse(data) {
  if (!data) {
    return {
      networkIn: 0,
      networkOut: 0,
    };
  }

  const networkIn =
    findNumericValue(data, [
      "network_in",
      "networkIn",
      "rx",
      "receive",
      "received",
      "rx_bytes",
      "bytes_received",
      "in",
    ]) ?? 0;

  const networkOut =
    findNumericValue(data, [
      "network_out",
      "networkOut",
      "tx",
      "transmit",
      "transmitted",
      "tx_bytes",
      "bytes_sent",
      "out",
    ]) ?? 0;

  return {
    networkIn,
    networkOut,
  };
}

/* =========================================================
   COMPOSANT
   ========================================================= */

export default function UserDashboard({ onLogout }) {
  const [vms, setVms] = useState([]);
  const [containers, setContainers] = useState([]);

  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    networkIn: 0,
    networkOut: 0,
  });

  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [lastUpdate, setLastUpdate] = useState(null);

  const [monitoringStatus, setMonitoringStatus] =
    useState("unknown");

  const [proxmoxStatus, setProxmoxStatus] =
    useState("unknown");

  /* =======================================================
     REQUÊTE HTTP
     ======================================================= */

  const fetchJSON = useCallback(async (url) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Erreur HTTP ${response.status} sur ${url}`
      );
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Réponse invalide reçue depuis ${url}`
      );
    }

    return response.json();
  }, []);

  /* =======================================================
     CHARGEMENT DES DONNÉES
     ======================================================= */

  const loadDashboard = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setRefreshing(true);
      }

      try {
        setError("");

        /*
         * Les routes VMs existent déjà dans Django.
         */
        const [
          vmResult,
          containerResult,
          prometheusResult,
          cpuResult,
          memoryResult,
          storageResult,
          networkResult,
        ] = await Promise.allSettled([
          fetchJSON("/vms/"),
          fetchJSON("/vms/containers/"),

          /*
           * Vérification générale Prometheus.
           */
          fetchJSON("/monitoring/prometheus/"),

          /*
           * Métriques réelles exposées par Django.
           */
          fetchJSON("/monitoring/prometheus/metrics/cpu/"),
          fetchJSON("/monitoring/prometheus/metrics/memory/"),
          fetchJSON("/monitoring/prometheus/metrics/storage/"),
          fetchJSON("/monitoring/prometheus/metrics/network/"),
        ]);

        /* =================================================
           VMs
           ================================================= */

        if (vmResult.status === "fulfilled") {
          const vmData = extractArray(vmResult.value, [
            "vms",
            "virtual_machines",
            "virtualMachines",
          ]);

          setVms(vmData);

          /*
           * Si Django répond correctement à l'API VM,
           * Proxmox est considéré accessible.
           */
          setProxmoxStatus("running");
        } else {
          setProxmoxStatus("unknown");
        }

        /* =================================================
           CONTENEURS
           ================================================= */

        if (containerResult.status === "fulfilled") {
          const containerData = extractArray(
            containerResult.value,
            [
              "containers",
              "lxc",
              "lxcs",
            ]
          );

          setContainers(containerData);

          /*
           * Un endpoint Proxmox conteneurs qui répond
           * confirme également l'accessibilité.
           */
          if (vmResult.status === "fulfilled") {
            setProxmoxStatus("running");
          }
        }

        /* =================================================
           PROMETHEUS
           ================================================= */

        const prometheusAvailable =
          prometheusResult.status === "fulfilled" ||
          cpuResult.status === "fulfilled" ||
          memoryResult.status === "fulfilled" ||
          storageResult.status === "fulfilled" ||
          networkResult.status === "fulfilled";

        setMonitoringStatus(
          prometheusAvailable ? "running" : "stopped"
        );

        /* =================================================
           CPU
           ================================================= */

        const cpu =
          cpuResult.status === "fulfilled"
            ? normalizeMetricResponse(
                cpuResult.value,
                "cpu"
              )
            : metrics.cpu;

        /* =================================================
           MÉMOIRE
           ================================================= */

        const memory =
          memoryResult.status === "fulfilled"
            ? normalizeMetricResponse(
                memoryResult.value,
                "memory"
              )
            : metrics.memory;

        /* =================================================
           STOCKAGE
           ================================================= */

        const disk =
          storageResult.status === "fulfilled"
            ? normalizeMetricResponse(
                storageResult.value,
                "disk"
              )
            : metrics.disk;

        /* =================================================
           RÉSEAU
           ================================================= */

        const network =
          networkResult.status === "fulfilled"
            ? normalizeNetworkResponse(networkResult.value)
            : {
                networkIn: metrics.networkIn,
                networkOut: metrics.networkOut,
              };

        const nextMetrics = {
          cpu,
          memory,
          disk,
          networkIn: network.networkIn,
          networkOut: network.networkOut,
        };

        setMetrics(nextMetrics);

        /* =================================================
           HISTORIQUE
           ================================================= */

        const now = new Date();

        setHistory((previous) => {
          const point = {
            time: getTimeLabel(now),
            cpu,
            memory,
            disk,
          };

          const next = [...previous, point];

          return next.slice(-MAX_HISTORY_POINTS);
        });

        setLastUpdate(now);
      } catch (err) {
        console.error(
          "Erreur dashboard utilisateur :",
          err
        );

        setError(
          err?.message ||
            "Impossible de récupérer les données du dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchJSON, metrics]
  );

  /* =======================================================
     CHARGEMENT INITIAL + RAFRAÎCHISSEMENT
     ======================================================= */

  useEffect(() => {
    loadDashboard();

    const interval = window.setInterval(() => {
      loadDashboard(false);
    }, REFRESH_INTERVAL);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  /* =======================================================
     CALCULS
     ======================================================= */

  const runningVMs = useMemo(
    () =>
      vms.filter(
        (vm) =>
          normalizeStatus(vm.status) === "running"
      ).length,
    [vms]
  );

  const stoppedVMs = useMemo(
    () =>
      vms.filter(
        (vm) =>
          normalizeStatus(vm.status) === "stopped"
      ).length,
    [vms]
  );

  const runningContainers = useMemo(
    () =>
      containers.filter(
        (container) =>
          normalizeStatus(container.status) ===
          "running"
      ).length,
    [containers]
  );

  const stoppedContainers = useMemo(
    () =>
      containers.filter(
        (container) =>
          normalizeStatus(container.status) ===
          "stopped"
      ).length,
    [containers]
  );

  const totalResources = vms.length + containers.length;

  const infrastructureStatus =
    proxmoxStatus === "running" &&
    monitoringStatus === "running"
      ? "running"
      : proxmoxStatus === "stopped"
        ? "stopped"
        : "unknown";

  /* =======================================================
     TABLEAU DES RESSOURCES
     ======================================================= */

  const resourceRows = useMemo(() => {
    const vmRows = vms.map((vm) => ({
      id: `vm-${vm.vmid}`,
      type: "VM",
      name:
        vm.name ||
        vm.hostname ||
        `VM ${vm.vmid}`,
      node: vm.node || "—",
      cpu:
        vm.cpus ??
        vm.cpu ??
        "—",
      memory:
        vm.mem !== undefined
          ? formatMemoryMB(vm.mem)
          : "—",
      disk:
        vm.disk !== undefined
          ? formatBytes(vm.disk)
          : "—",
      status: vm.status,
    }));

    const containerRows = containers.map(
      (container) => ({
        id: `lxc-${container.vmid}`,
        type: "LXC",
        name:
          container.hostname ||
          container.name ||
          `LXC ${container.vmid}`,
        node: container.node || "—",
        cpu:
          container.cpus ??
          container.cpu ??
          "—",
        memory:
          container.mem !== undefined
            ? formatMemoryMB(container.mem)
            : "—",
        disk:
          container.disk !== undefined
            ? formatBytes(container.disk)
            : "—",
        status: container.status,
      })
    );

    return [...vmRows, ...containerRows];
  }, [vms, containers]);

  /* =======================================================
     STATUT
     ======================================================= */

  const StatusBadge = ({ status }) => {
    const normalized = normalizeStatus(status);

    if (normalized === "running") {
      return (
        <span className="ud-status ud-status-running">
          <CheckCircle2 size={14} />
          En ligne
        </span>
      );
    }

    if (normalized === "stopped") {
      return (
        <span className="ud-status ud-status-stopped">
          <XCircle size={14} />
          Arrêté
        </span>
      );
    }

    return (
      <span className="ud-status ud-status-unknown">
        <Circle size={12} />
        Inconnu
      </span>
    );
  };

  const SystemStatus = ({
    icon: Icon,
    title,
    description,
    status,
  }) => {
    const isRunning = status === "running";
    const isStopped = status === "stopped";

    return (
      <div className="ud-system-status">
        <div className="ud-system-icon">
          <Icon size={21} />
        </div>

        <div className="ud-system-info">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>

        <div
          className={`ud-system-state ${
            isRunning
              ? "is-running"
              : isStopped
                ? "is-stopped"
                : "is-unknown"
          }`}
        >
          {isRunning ? (
            <CheckCircle2 size={15} />
          ) : isStopped ? (
            <XCircle size={15} />
          ) : (
            <Circle size={15} />
          )}

          {isRunning
            ? "Opérationnel"
            : isStopped
              ? "Indisponible"
              : "Inconnu"}
        </div>
      </div>
    );
  };

  /* =======================================================
     LOGOUT
     ======================================================= */

  const handleLogout = async () => {
    try {
      if (typeof onLogout === "function") {
        await onLogout();
        return;
      }

      await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (err) {
      console.error(
        "Erreur lors de la déconnexion :",
        err
      );
    } finally {
      /*
       * Sécurité supplémentaire :
       * on force le retour vers la page de connexion.
       */
      window.location.href = "/";
    }
  };

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="ud-page">
      <div className="ud-container">

        {/* =================================================
            HEADER
            ================================================= */}

        <header className="ud-header">
          <div className="ud-header-left">
            <div className="ud-brand-icon">
              <Activity size={24} />
            </div>

            <div>
              <h1>Tableau de bord</h1>

              <p>
                Vue d'ensemble de l'infrastructure
              </p>
            </div>
          </div>

          <div className="ud-header-right">
            <div className="ud-last-update">
              <span className="ud-live-dot" />

              <span>
                {lastUpdate
                  ? `Mis à jour à ${getTimeLabel(
                      lastUpdate
                    )}`
                  : "Mise à jour..."}
              </span>
            </div>

            <button
              type="button"
              className="ud-refresh-button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              title="Actualiser les données"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "ud-spin"
                    : ""
                }
              />

              <span>
                {refreshing
                  ? "Actualisation..."
                  : "Actualiser"}
              </span>
            </button>

            <button
              type="button"
              className="ud-logout-button"
              onClick={handleLogout}
              title="Se déconnecter"
            >
              <LogOut size={17} />
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        {/* =================================================
            ERREUR
            ================================================= */}

        {error && (
          <div className="ud-alert">
            <AlertCircle size={20} />

            <div>
              <strong>
                Impossible de récupérer toutes
                les données
              </strong>

              <p>{error}</p>
            </div>
          </div>
        )}

        {/* =================================================
            STATISTIQUES PRINCIPALES
            ================================================= */}

        <section className="ud-stats-grid">

          <article className="ud-stat-card">
            <div className="ud-stat-icon">
              <Server size={21} />
            </div>

            <div className="ud-stat-content">
              <span className="ud-stat-label">
                Machines virtuelles
              </span>

              <strong className="ud-stat-value">
                {loading ? "—" : vms.length}
              </strong>

              <span className="ud-stat-detail">
                {runningVMs} en ligne ·{" "}
                {stoppedVMs} arrêtée
                {stoppedVMs > 1 ? "s" : ""}
              </span>
            </div>
          </article>

          <article className="ud-stat-card">
            <div className="ud-stat-icon">
              <Database size={21} />
            </div>

            <div className="ud-stat-content">
              <span className="ud-stat-label">
                Conteneurs LXC
              </span>

              <strong className="ud-stat-value">
                {loading
                  ? "—"
                  : containers.length}
              </strong>

              <span className="ud-stat-detail">
                {runningContainers} en ligne ·{" "}
                {stoppedContainers} arrêté
                {stoppedContainers > 1
                  ? "s"
                  : ""}
              </span>
            </div>
          </article>

          <article className="ud-stat-card">
            <div className="ud-stat-icon">
              <Cpu size={21} />
            </div>

            <div className="ud-stat-content">
              <span className="ud-stat-label">
                Utilisation CPU
              </span>

              <strong className="ud-stat-value">
                {formatNumber(metrics.cpu)}%
              </strong>

              <span className="ud-stat-detail">
                Utilisation actuelle
              </span>
            </div>
          </article>

          <article className="ud-stat-card">
            <div className="ud-stat-icon">
              <MemoryStick size={21} />
            </div>

            <div className="ud-stat-content">
              <span className="ud-stat-label">
                Mémoire
              </span>

              <strong className="ud-stat-value">
                {formatNumber(metrics.memory)}%
              </strong>

              <span className="ud-stat-detail">
                Utilisation actuelle
              </span>
            </div>
          </article>

        </section>

        {/* =================================================
            ÉTAT INFRASTRUCTURE
            ================================================= */}

        <section className="ud-section">

          <div className="ud-section-header">
            <div>
              <h2>État de l'infrastructure</h2>

              <p>
                Disponibilité des services de
                supervision
              </p>
            </div>

            <span
              className={`ud-section-live ${
                infrastructureStatus ===
                "running"
                  ? "is-live"
                  : ""
              }`}
            >
              <span />
              Surveillance active
            </span>
          </div>

          <div className="ud-system-grid">

            <SystemStatus
              icon={Server}
              title="Proxmox VE"
              description="Virtualisation et conteneurs"
              status={proxmoxStatus}
            />

            <SystemStatus
              icon={Activity}
              title="Prometheus"
              description="Collecte et supervision"
              status={monitoringStatus}
            />

            <SystemStatus
              icon={Wifi}
              title="Infrastructure"
              description={`${totalResources} ressource${
                totalResources > 1
                  ? "s"
                  : ""
              } détectée${
                totalResources > 1
                  ? "s"
                  : ""
              }`}
              status={infrastructureStatus}
            />

          </div>

        </section>

        {/* =================================================
            MÉTRIQUES
            ================================================= */}

        <section className="ud-section">

          <div className="ud-section-header">
            <div>
              <h2>Performances</h2>

              <p>
                Évolution des ressources
                système
              </p>
            </div>
          </div>

          <div className="ud-metrics-grid">

            {/* CPU */}
            <article className="ud-metric-card">

              <div className="ud-metric-header">
                <div>
                  <span className="ud-metric-label">
                    CPU
                  </span>

                  <strong>
                    {formatNumber(
                      metrics.cpu
                    )}
                    %
                  </strong>
                </div>

                <div className="ud-metric-icon">
                  <Cpu size={20} />
                </div>
              </div>

              <div className="ud-progress">
                <div
                  className="ud-progress-bar"
                  style={{
                    width: `${metrics.cpu}%`,
                  }}
                />
              </div>

              <div className="ud-metric-footer">
                <span>
                  Utilisation
                </span>

                <span>
                  {formatNumber(
                    metrics.cpu
                  )}%
                </span>
              </div>

            </article>

            {/* MÉMOIRE */}
            <article className="ud-metric-card">

              <div className="ud-metric-header">
                <div>
                  <span className="ud-metric-label">
                    Mémoire
                  </span>

                  <strong>
                    {formatNumber(
                      metrics.memory
                    )}
                    %
                  </strong>
                </div>

                <div className="ud-metric-icon">
                  <MemoryStick size={20} />
                </div>
              </div>

              <div className="ud-progress">
                <div
                  className="ud-progress-bar"
                  style={{
                    width: `${metrics.memory}%`,
                  }}
                />
              </div>

              <div className="ud-metric-footer">
                <span>
                  Utilisation
                </span>

                <span>
                  {formatNumber(
                    metrics.memory
                  )}%
                </span>
              </div>

            </article>

            {/* STOCKAGE */}
            <article className="ud-metric-card">

              <div className="ud-metric-header">
                <div>
                  <span className="ud-metric-label">
                    Stockage
                  </span>

                  <strong>
                    {formatNumber(
                      metrics.disk
                    )}
                    %
                  </strong>
                </div>

                <div className="ud-metric-icon">
                  <HardDrive size={20} />
                </div>
              </div>

              <div className="ud-progress">
                <div
                  className="ud-progress-bar"
                  style={{
                    width: `${metrics.disk}%`,
                  }}
                />
              </div>

              <div className="ud-metric-footer">
                <span>
                  Espace utilisé
                </span>

                <span>
                  {formatNumber(
                    metrics.disk
                  )}%
                </span>
              </div>

            </article>

            {/* RÉSEAU */}
            <article className="ud-metric-card">

              <div className="ud-metric-header">
                <div>
                  <span className="ud-metric-label">
                    Réseau
                  </span>

                  <strong>
                    Actif
                  </strong>
                </div>

                <div className="ud-metric-icon">
                  <Wifi size={20} />
                </div>
              </div>

              <div className="ud-network-values">
                <div>
                  <span>Entrant</span>
                  <strong>
                    {formatBytes(
                      metrics.networkIn
                    )}
                  </strong>
                </div>

                <div>
                  <span>Sortant</span>
                  <strong>
                    {formatBytes(
                      metrics.networkOut
                    )}
                  </strong>
                </div>
              </div>

            </article>

          </div>

        </section>

        {/* =================================================
            GRAPHIQUE
            ================================================= */}

        <section className="ud-section">

          <div className="ud-section-header">
            <div>
              <h2>
                Évolution des ressources
              </h2>

              <p>
                Historique des dernières
                mesures
              </p>
            </div>
          </div>

          <div className="ud-chart-card">

            {history.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <LineChart
                  data={history}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="ud-chart-grid"
                  />

                  <XAxis
                    dataKey="time"
                    tick={{
                      fontSize: 11,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 11,
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `${value}%`
                    }
                  />

                  <Tooltip
                    formatter={(value) =>
                      `${formatNumber(
                        value
                      )}%`
                    }
                  />

                  <Line
                    type="monotone"
                    dataKey="cpu"
                    name="CPU"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="memory"
                    name="Mémoire"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="disk"
                    name="Stockage"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="ud-empty-chart">
                <Activity size={28} />

                <span>
                  En attente des données
                  Prometheus...
                </span>
              </div>
            )}

          </div>

        </section>

        {/* =================================================
            RÉSUMÉ DES RESSOURCES
            ================================================= */}

        <section className="ud-section">

          <div className="ud-section-header">
            <div>
              <h2>
                Ressources disponibles
              </h2>

              <p>
                Vue en lecture seule des
                machines et conteneurs
              </p>
            </div>

            <span className="ud-readonly-badge">
              Lecture seule
            </span>
          </div>

          <div className="ud-resource-summary">

            <div className="ud-resource-summary-card">
              <Server size={19} />

              <div>
                <span>VM</span>

                <strong>
                  {vms.length}
                </strong>
              </div>
            </div>

            <div className="ud-resource-summary-card">
              <Database size={19} />

              <div>
                <span>LXC</span>

                <strong>
                  {containers.length}
                </strong>
              </div>
            </div>

            <div className="ud-resource-summary-card">
              <CheckCircle2 size={19} />

              <div>
                <span>En ligne</span>

                <strong>
                  {runningVMs +
                    runningContainers}
                </strong>
              </div>
            </div>

            <div className="ud-resource-summary-card">
              <XCircle size={19} />

              <div>
                <span>Arrêtées</span>

                <strong>
                  {stoppedVMs +
                    stoppedContainers}
                </strong>
              </div>
            </div>

          </div>

        </section>

        {/* =================================================
            TABLEAU
            ================================================= */}

        <section className="ud-section">

          <div className="ud-section-header">
            <div>
              <h2>
                Machines et conteneurs
              </h2>

              <p>
                Informations fournies par
                Proxmox VE
              </p>
            </div>
          </div>

          <div className="ud-table-wrapper">

            {resourceRows.length > 0 ? (
              <table className="ud-table">

                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Nom</th>
                    <th>Nœud</th>
                    <th>CPU</th>
                    <th>Mémoire</th>
                    <th>Disque</th>
                    <th>État</th>
                  </tr>
                </thead>

                <tbody>
                  {resourceRows.map(
                    (resource) => (
                      <tr
                        key={resource.id}
                      >
                        <td>
                          <span
                            className={`ud-type-badge ${
                              resource.type ===
                              "VM"
                                ? "ud-type-vm"
                                : "ud-type-lxc"
                            }`}
                          >
                            {resource.type}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {resource.name}
                          </strong>
                        </td>

                        <td>
                          {resource.node}
                        </td>

                        <td>
                          {resource.cpu}
                        </td>

                        <td>
                          {resource.memory}
                        </td>

                        <td>
                          {resource.disk}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              resource.status
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

              </table>
            ) : (
              <div className="ud-empty-state">
                <Server size={30} />

                <strong>
                  Aucune ressource disponible
                </strong>

                <span>
                  Aucune VM ou aucun conteneur
                  n'a été retourné par Proxmox
                  VE.
                </span>
              </div>
            )}

          </div>

        </section>

        {/* =================================================
            INFORMATIONS
            ================================================= */}

        <section className="ud-info-box">

          <div className="ud-info-icon">
            <AlertCircle size={20} />
          </div>

          <div>
            <strong>
              Interface utilisateur standard
            </strong>

            <p>
              Cette interface permet
              uniquement de consulter l'état
              de l'infrastructure et ses
              métriques. Les opérations de
              création, modification,
              suppression et administration
              sont réservées aux
              administrateurs.
            </p>
          </div>

        </section>

        {/* =================================================
            FOOTER
            ================================================= */}

        <footer className="ud-footer">

          <div>
            <strong>
              HorizonOps
            </strong>

            <span>
              Interface utilisateur standard
            </span>
          </div>

          <div>
            <span>
              Accès en lecture seule
            </span>
          </div>

        </footer>

      </div>
    </div>
  );
}