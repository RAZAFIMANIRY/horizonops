import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  Target,
  Wifi,
  XCircle,
} from "lucide-react";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { apiFetch } from "../api";


/* =========================================================
   HELPERS
========================================================= */

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  let index = 0;
  let size = value;

  while (
    size >= 1024 &&
    index < units.length - 1
  ) {
    size /= 1024;
    index++;
  }

  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0%";
  }

  return `${number.toFixed(1)}%`;
}

function formatTime(timestamp) {
  if (
    timestamp === null ||
    timestamp === undefined ||
    timestamp === ""
  ) {
    return "--:--:--";
  }

  const numericTimestamp = Number(timestamp);

  if (!Number.isFinite(numericTimestamp)) {
    return "--:--:--";
  }

  const date = new Date(
    numericTimestamp * 1000
  );

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString();
}

function calculatePercentage(used, total) {
  const usedValue = Number(used);
  const totalValue = Number(total);

  if (
    !Number.isFinite(usedValue) ||
    !Number.isFinite(totalValue) ||
    totalValue <= 0
  ) {
    return 0;
  }

  return (usedValue / totalValue) * 100;
}

/* =========================================================
   PROMETHEUS RESPONSE HELPERS
========================================================= */

/**
 * Extrait les séries depuis différentes structures
 * possibles retournées par Django/Prometheus.
 */
function extractResult(data) {
  if (!data) {
    return [];
  }

  /* Tableau direct */
  if (Array.isArray(data)) {
    return data;
  }

  /* { result: [...] } */
  if (Array.isArray(data.result)) {
    return data.result;
  }

  /* { data: { result: [...] } } */
  if (Array.isArray(data.data?.result)) {
    return data.data.result;
  }

  /*
   * Prometheus /api/v1/targets
   *
   * {
   *   data: {
   *     activeTargets: [...]
   *   }
   * }
   */
  if (Array.isArray(data.activeTargets)) {
    return data.activeTargets;
  }

  if (
    Array.isArray(
      data.data?.activeTargets
    )
  ) {
    return data.data.activeTargets;
  }

  /* Structures éventuelles du backend */
  if (Array.isArray(data.targets)) {
    return data.targets;
  }

  if (Array.isArray(data.data?.targets)) {
    return data.data.targets;
  }

  return [];
}

/**
 * Extrait la valeur instantanée d'une série Prometheus.
 *
 * Exemple :
 *
 * value: [1758780000, "42.5"]
 */
function extractValue(item) {
  if (!item) {
    return null;
  }

  const value = item.value;

  if (
    Array.isArray(value) &&
    value.length >= 2
  ) {
    const number = Number(value[1]);

    return Number.isFinite(number)
      ? number
      : null;
  }

  return null;
}

/**
 * Retourne la première valeur valide
 * trouvée dans un résultat Prometheus.
 */
function getCurrentValue(result) {
  if (
    !Array.isArray(result) ||
    result.length === 0
  ) {
    return null;
  }

  for (const item of result) {
    const value = extractValue(item);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

/**
 * Recherche une métrique correspondant au nœud PVE.
 */
function getMetricByNode(
  result,
  nodeId = "node/pve"
) {
  if (!Array.isArray(result)) {
    return null;
  }

  /* Recherche exacte */
  const metric = result.find(
    (item) =>
      item?.metric?.id === nodeId
  );

  if (metric) {
    return extractValue(metric);
  }

  /* Recherche plus souple */
  const nodeMetric = result.find(
    (item) =>
      item?.metric?.type === "node" ||
      item?.metric?.node === "pve" ||
      item?.metric?.instance === "pve"
  );

  if (nodeMetric) {
    return extractValue(nodeMetric);
  }

  return getCurrentValue(result);
}

/**
 * Transforme une réponse query_range Prometheus
 * en tableau exploitable par Recharts.
 *
 * Structure habituelle :
 *
 * {
 *   data: {
 *     result: [
 *       {
 *         metric: {...},
 *         values: [
 *           [timestamp, "value"],
 *           [timestamp, "value"]
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
function getHistory(data) {
  if (!data) {
    return [];
  }

  let result = [];

  /* { result: [...] } */
  if (Array.isArray(data.result)) {
    result = data.result;
  }

  /* { data: { result: [...] } } */
  else if (
    Array.isArray(data.data?.result)
  ) {
    result = data.data.result;
  }

  /* Tableau direct */
  else if (Array.isArray(data)) {
    result = data;
  }

  if (result.length === 0) {
    return [];
  }

  const allValues = [];

  /*
   * Structure Prometheus query_range :
   *
   * series.values
   */
  result.forEach((series) => {
    if (Array.isArray(series?.values)) {
      allValues.push(
        ...series.values
      );
    }
  });

  /*
   * Certains backends peuvent retourner
   * directement :
   *
   * [
   *   [timestamp, value],
   *   [timestamp, value]
   * ]
   */
  if (
    allValues.length === 0 &&
    Array.isArray(result[0]) &&
    result[0].length >= 2
  ) {
    allValues.push(...result);
  }

  return allValues
    .map(([timestamp, value]) => ({
      time: Number(timestamp),
      value: Number(value),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.time) &&
        Number.isFinite(item.value)
    )
    .sort(
      (a, b) => a.time - b.time
    );
}

/* =========================================================
   API RESPONSE
========================================================= */

async function readApiResponse(response) {
  if (!response) {
    return {
      status: 0,
      data: null,
    };
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    status: response.status,
    data,
  };
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  online,
  label,
}) {
  return (
    <div
      className={`status-badge ${
        online
          ? "status-online"
          : "status-offline"
      }`}
    >
      {online ? (
        <CheckCircle2 size={15} />
      ) : (
        <XCircle size={15} />
      )}

      <span>{label}</span>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="prometheus-summary-card">
      <div className="prometheus-summary-icon">
        <Icon size={22} />
      </div>

      <div className="prometheus-summary-content">
        <span className="prometheus-summary-title">
          {title}
        </span>

        <strong className="prometheus-summary-value">
          {value}
        </strong>

        <span className="prometheus-summary-description">
          {description}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   METRIC DETAIL CARD
========================================================= */

function MetricDetailCard({
  title,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="metric-detail-card">
      <div className="metric-detail-header">
        <div className="metric-detail-icon">
          <Icon size={20} />
        </div>

        <span>{title}</span>
      </div>

      <div className="metric-detail-value">
        {value}
      </div>

      <div className="metric-detail-description">
        {description}
      </div>
    </div>
  );
}

/* =========================================================
   TARGET CARD
========================================================= */

function TargetCard({ target }) {
  const isUp =
    target?.health === "up";

  const job =
    target?.labels?.job ||
    target?.scrapePool ||
    "Prometheus target";

  const url =
    target?.scrapeUrl ||
    target?.labels?.instance ||
    "—";

  return (
    <div className="prometheus-target">
      <div className="prometheus-target-header">
        <div>
          <strong>{job}</strong>

          <div className="prometheus-target-url">
            {url}
          </div>
        </div>

        {isUp ? (
          <CheckCircle2 size={20} />
        ) : (
          <XCircle size={20} />
        )}
      </div>

      <div className="prometheus-target-status">
        {isUp
          ? "Disponible"
          : "Indisponible"}
      </div>
    </div>
  );
}

/* =========================================================
   CHART CARD
========================================================= */

function ChartCard({
  title,
  data,
  unit = "",
  domain,
}) {
  const chartData = Array.isArray(data)
    ? data.filter(
        (item) =>
          Number.isFinite(Number(item?.time)) &&
          Number.isFinite(Number(item?.value))
      )
    : [];

  const hasData = chartData.length > 0;

  console.log(
    `[HorizonOps] ${title} - données graphique:`,
    chartData.length,
    chartData
  );

  return (
    <div className="prometheus-chart-card">
      <div className="prometheus-chart-header">
        <div>
          <h3>{title}</h3>

          <span>
            Évolution sur la dernière heure
          </span>
        </div>

        <span>
          {chartData.length} points
        </span>
      </div>

      <div
        style={{
          width: "100%",
          height: "300px",
          minHeight: "300px",
          position: "relative",
        }}
      >
        {!hasData ? (
          <div
            className="chart-empty"
            style={{
              width: "100%",
              height: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Aucune donnée historique disponible.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={1}
            minHeight={300}
          >
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                type="number"
                dataKey="time"
                domain={[
                  "dataMin",
                  "dataMax",
                ]}
                tickFormatter={formatTime}
                tick={{
                  fontSize: 10,
                }}
              />

              <YAxis
                type="number"
                domain={domain}
                tickFormatter={(value) =>
                  `${Number(value).toFixed(0)}${unit}`
                }
                tick={{
                  fontSize: 10,
                }}
              />

              <Tooltip
                labelFormatter={(value) =>
                  formatTime(value)
                }
                formatter={(value) => [
                  `${Number(value).toFixed(1)}${unit}`,
                  title,
                ]}
              />

              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                }}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   STORAGE SUMMARY
========================================================= */

function getStorageSummary(
  storage
) {
  const sizeResult =
    extractResult(
      storage?.size
    );

  const usedResult =
    extractResult(
      storage?.used
    );

  let total = 0;
  let used = 0;

  if (sizeResult.length > 0) {
    total =
      extractValue(
        sizeResult[0]
      ) || 0;
  }

  if (usedResult.length > 0) {
    used =
      extractValue(
        usedResult[0]
      ) || 0;
  }

  return {
    total,
    used,
    percentage:
      calculatePercentage(
        used,
        total
      ),
  };
}

/* =========================================================
   NETWORK SUMMARY
========================================================= */

function getNetworkSummary(
  network
) {
  const receive =
    extractResult(
      network?.receive
    );

  const transmit =
    extractResult(
      network?.transmit
    );

  let receiveTotal = 0;
  let transmitTotal = 0;

  receive.forEach((item) => {
    const value =
      extractValue(item);

    if (value !== null) {
      receiveTotal += value;
    }
  });

  transmit.forEach((item) => {
    const value =
      extractValue(item);

    if (value !== null) {
      transmitTotal += value;
    }
  });

  return {
    receive: receiveTotal,
    transmit: transmitTotal,
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Prometheus() {
  const [overview, setOverview] =
    useState(null);

  const [targets, setTargets] =
    useState([]);

  const [cpu, setCpu] =
    useState(null);

  const [memoryUsage, setMemoryUsage] =
    useState(null);

  const [memorySize, setMemorySize] =
    useState(null);

  const [cpuHistory, setCpuHistory] =
    useState([]);

  const [memoryHistory, setMemoryHistory] =
    useState([]);

  const [storage, setStorage] =
    useState(null);

  const [network, setNetwork] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [lastUpdate, setLastUpdate] =
    useState(null);

  /* =======================================================
     FETCH DATA
  ======================================================= */

  const loadData = useCallback(
    async () => {
      try {
        setError(null);

        const responses =
          await Promise.all([
            apiFetch(
              "/monitoring/prometheus/"
            ),

            apiFetch(
              "/monitoring/prometheus/targets/"
            ),

            apiFetch(
              "/monitoring/prometheus/metrics/cpu/"
            ),

            apiFetch(
              "/monitoring/prometheus/metrics/memory/"
            ),

            apiFetch(
              "/monitoring/prometheus/history/cpu/"
            ),

            apiFetch(
              "/monitoring/prometheus/history/memory/"
            ),

            apiFetch(
              "/monitoring/prometheus/metrics/storage/"
            ),

            apiFetch(
              "/monitoring/prometheus/metrics/network/"
            ),
          ]);

        const [
          overviewApi,
          targetsApi,
          cpuApi,
          memoryApi,
          cpuHistoryApi,
          memoryHistoryApi,
          storageApi,
          networkApi,
        ] = await Promise.all(
          responses.map(
            readApiResponse
          )
        );

        /* -----------------------------------------------
           DEBUG
        ------------------------------------------------ */

        console.log(
          "[HorizonOps] Prometheus:",
          overviewApi.data
        );

        console.log(
          "[HorizonOps] Targets HTTP:",
          targetsApi.status
        );

        console.log(
          "[HorizonOps] Targets data:",
          targetsApi.data
        );

        console.log(
          "[HorizonOps] CPU:",
          cpuApi.data
        );

        console.log(
          "[HorizonOps] Memory HTTP:",
          memoryApi.status
        );

        console.log(
          "[HorizonOps] Memory data:",
          memoryApi.data
        );

        console.log(
          "[HorizonOps] CPU HISTORY HTTP:",
          cpuHistoryApi.status
        );

        console.log(
          "[HorizonOps] CPU HISTORY DATA:",
          cpuHistoryApi.data
        );

        console.log(
          "[HorizonOps] MEMORY HISTORY HTTP:",
          memoryHistoryApi.status
        );

        console.log(
          "[HorizonOps] MEMORY HISTORY DATA:",
          memoryHistoryApi.data
        );

        /* -----------------------------------------------
           PARSED DATA DEBUG
        ------------------------------------------------ */

        const parsedTargets =
          extractResult(
            targetsApi.data
          );

        const parsedCpuHistory =
          getHistory(
            cpuHistoryApi.data
          );

        const parsedMemoryHistory =
          getHistory(
            memoryHistoryApi.data
          );

        console.log(
          "[HorizonOps] TARGETS PARSED:",
          parsedTargets
        );

        console.log(
          "[HorizonOps] CPU HISTORY PARSED:",
          parsedCpuHistory
        );

        console.log(
          "[HorizonOps] MEMORY HISTORY PARSED:",
          parsedMemoryHistory
        );

        /* -----------------------------------------------
           STATE
        ------------------------------------------------ */

        setOverview(
          overviewApi.data
        );

        setTargets(
          parsedTargets
        );

        setCpu(
          cpuApi.data
        );

        setMemoryUsage(
          memoryApi.data?.usage ||
            memoryApi.data
        );

        setMemorySize(
          memoryApi.data?.size ||
            null
        );

        setCpuHistory(
          parsedCpuHistory
        );

        setMemoryHistory(
          parsedMemoryHistory
        );

        setStorage(
          storageApi.data
        );

        setNetwork(
          networkApi.data
        );

        setLastUpdate(
          new Date()
        );
      } catch (err) {
        console.error(
          "[HorizonOps] Monitoring error:",
          err
        );

        setError(
          err?.message ||
            "Erreur lors du chargement des données."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    loadData();

    const interval =
      setInterval(
        loadData,
        5000
      );

    return () =>
      clearInterval(interval);
  }, [loadData]);

  /* =======================================================
     PROMETHEUS STATUS
  ======================================================= */

  const prometheusOnline =
    overview?.prometheus
      ?.available === true ||
    overview?.available === true ||
    overview?.status ===
      "success";

  const proxmoxOnline =
    overview?.proxmox
      ?.available === true ||
    overview?.proxmox_available ===
      true;

  /* =======================================================
     CPU
  ======================================================= */

  const cpuResult =
    extractResult(cpu);

  /*
   * IMPORTANT :
   *
   * Le backend retourne déjà une
   * valeur en pourcentage.
   *
   * Exemple :
   *
   * 40 = 40 %
   *
   * Il ne faut PAS multiplier par 100.
   */

  const cpuValue =
    getMetricByNode(
      cpuResult,
      "node/pve"
    );

  /* =======================================================
     MEMORY
  ======================================================= */

  const memoryUsageResult =
    extractResult(
      memoryUsage
    );

  const memorySizeResult =
    extractResult(
      memorySize
    );

  const memoryUsed =
    getMetricByNode(
      memoryUsageResult,
      "node/pve"
    );

  const memoryTotal =
    getMetricByNode(
      memorySizeResult,
      "node/pve"
    );

  const memoryPercentage =
    calculatePercentage(
      memoryUsed,
      memoryTotal
    );

  /* =======================================================
     STORAGE
  ======================================================= */

  const storageSummary =
    getStorageSummary(
      storage
    );

  /* =======================================================
     NETWORK
  ======================================================= */

  const networkSummary =
    getNetworkSummary(
      network
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="prometheus-page">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="prometheus-header">
        <div>
          <h1>
            Supervision Prometheus
          </h1>

          <p>
            Surveillance en temps réel
            de l'infrastructure HorizonOps
          </p>
        </div>

        <div className="prometheus-header-actions">

          <StatusBadge
            online={prometheusOnline}
            label={
              prometheusOnline
                ? "Prometheus disponible"
                : "Prometheus indisponible"
            }
          />

          <StatusBadge
            online={proxmoxOnline}
            label={
              proxmoxOnline
                ? "Proxmox disponible"
                : "Proxmox indisponible"
            }
          />

          <button
            type="button"
            className="refresh-button"
            onClick={loadData}
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

        </div>
      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="prometheus-error">
          <XCircle size={20} />

          <span>
            {error}
          </span>
        </div>
      )}

      {/* ===================================================
          LAST UPDATE
      =================================================== */}

      <div className="prometheus-update-info">
        <Activity size={15} />

        <span>
          Dernière mise à jour :{" "}
          {lastUpdate
            ? lastUpdate.toLocaleTimeString()
            : "—"}
        </span>
      </div>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="prometheus-summary-grid">

        <SummaryCard
          title="CPU"
          value={
            cpuValue !== null
              ? formatPercent(
                  cpuValue
                )
              : "—"
          }
          description="Utilisation CPU"
          icon={Cpu}
        />

        <SummaryCard
          title="Mémoire"
          value={
            memoryUsed !== null &&
            memoryTotal !== null
              ? formatPercent(
                  memoryPercentage
                )
              : "—"
          }
          description="Utilisation RAM"
          icon={MemoryStick}
        />

        <SummaryCard
          title="Stockage"
          value={
            storageSummary.total > 0
              ? formatPercent(
                  storageSummary.percentage
                )
              : "—"
          }
          description="Espace utilisé"
          icon={HardDrive}
        />

        <SummaryCard
          title="Cibles"
          value={targets.length}
          description="Cibles Prometheus"
          icon={Target}
        />

      </div>

      {/* ===================================================
          SYSTEM METRICS
      =================================================== */}

      <section className="prometheus-section">

        <div className="prometheus-section-title">
          <Server size={20} />

          <div>
            <h2>
              Métriques système
            </h2>

            <p>
              État actuel des ressources
              de l'infrastructure.
            </p>
          </div>
        </div>

        <div className="metric-detail-grid">

          <MetricDetailCard
            title="CPU"
            value={
              cpuValue !== null
                ? formatPercent(
                    cpuValue
                  )
                : "—"
            }
            description="Utilisation CPU du nœud Proxmox"
            icon={Cpu}
          />

          <MetricDetailCard
            title="Mémoire"
            value={
              memoryUsed !== null &&
              memoryTotal !== null
                ? formatPercent(
                    memoryPercentage
                  )
                : "—"
            }
            description={
              memoryUsed !== null &&
              memoryTotal !== null
                ? `${formatBytes(
                    memoryUsed
                  )} utilisés sur ${formatBytes(
                    memoryTotal
                  )}`
                : "Données indisponibles"
            }
            icon={MemoryStick}
          />

          <MetricDetailCard
            title="Stockage"
            value={
              storageSummary.total > 0
                ? formatPercent(
                    storageSummary.percentage
                  )
                : "—"
            }
            description={
              storageSummary.total > 0
                ? `${formatBytes(
                    storageSummary.used
                  )} utilisés sur ${formatBytes(
                    storageSummary.total
                  )}`
                : "Données indisponibles"
            }
            icon={HardDrive}
          />

          <MetricDetailCard
            title="Réseau"
            value={
              `${formatBytes(
                networkSummary.receive
              )}/s`
            }
            description={
              `Réception • ${formatBytes(
                networkSummary.transmit
              )}/s émission`
            }
            icon={Wifi}
          />

        </div>
      </section>

      {/* ===================================================
          HISTORY
      =================================================== */}

      <section className="prometheus-section">

        <div className="prometheus-section-title">
          <Activity size={20} />

          <div>
            <h2>
              Historique des métriques
            </h2>

            <p>
              Évolution des ressources
              au cours de la dernière heure.
            </p>
          </div>
        </div>

        <div className="prometheus-charts-grid">

          <ChartCard
            title="Utilisation CPU"
            data={cpuHistory}
            unit="%"
            domain={[
              0,
              100,
            ]}
          />

          <ChartCard
            title="Utilisation mémoire"
            data={memoryHistory}
            unit="%"
            domain={[
              0,
              100,
            ]}
          />

        </div>
      </section>

      {/* ===================================================
          STORAGE DETAILS
      =================================================== */}

      <section className="prometheus-section">

        <div className="prometheus-section-title">
          <Database size={20} />

          <div>
            <h2>
              Stockage
            </h2>

            <p>
              Détail des systèmes de fichiers
              surveillés par Prometheus.
            </p>
          </div>
        </div>

        <div className="metric-detail-list">

          {extractResult(
            storage?.size
          ).map(
            (item, index) => {

              const id =
                item?.metric?.device ||
                item?.metric?.mountpoint ||
                item?.metric?.instance ||
                "storage";

              const total =
                extractValue(item) || 0;

              const usedItem =
                extractResult(
                  storage?.used
                )[index];

              const used =
                extractValue(
                  usedItem
                ) || 0;

              const percentage =
                calculatePercentage(
                  used,
                  total
                );

              return (
                <div
                  key={`storage-${id}-${index}`}
                  className="metric-detail-card"
                >

                  <div className="metric-detail-header">

                    <div className="metric-detail-icon">
                      <HardDrive
                        size={20}
                      />
                    </div>

                    <span>
                      {item?.metric
                        ?.mountpoint ||
                        item?.metric
                          ?.device ||
                        "Stockage"}
                    </span>

                  </div>

                  <div className="metric-detail-value">
                    {formatPercent(
                      percentage
                    )}
                  </div>

                  <div className="metric-detail-description">
                    {formatBytes(
                      used
                    )}{" "}
                    utilisés sur{" "}
                    {formatBytes(
                      total
                    )}
                  </div>

                </div>
              );
            }
          )}

          {extractResult(
            storage?.size
          ).length === 0 && (
            <div className="empty-state">
              Aucune donnée de stockage
              disponible.
            </div>
          )}

        </div>
      </section>

      {/* ===================================================
          NETWORK DETAILS
      =================================================== */}

      <section className="prometheus-section">

        <div className="prometheus-section-title">
          <Wifi size={20} />

          <div>
            <h2>
              Réseau
            </h2>

            <p>
              Trafic réseau des interfaces
              surveillées.
            </p>
          </div>
        </div>

        <div className="metric-detail-list">

          {extractResult(
            network?.receive
          ).map(
            (receiveItem, index) => {

              const metric =
                receiveItem?.metric ||
                {};

              const id =
                metric?.device ||
                metric?.instance ||
                "network";

              const receive =
                extractValue(
                  receiveItem
                ) || 0;

              const transmitItem =
                extractResult(
                  network?.transmit
                )[index];

              const transmit =
                extractValue(
                  transmitItem
                ) || 0;

              return (
                <div
                  key={`network-${id}-${index}`}
                  className="metric-detail-card"
                >

                  <div className="metric-detail-header">

                    <div className="metric-detail-icon">
                      <Wifi
                        size={20}
                      />
                    </div>

                    <span>
                      {metric?.device ||
                        metric?.instance ||
                        "Interface réseau"}
                    </span>

                  </div>

                  <div className="metric-detail-value">
                    {formatBytes(
                      receive
                    )}
                    /s
                  </div>

                  <div className="metric-detail-description">
                    Réception •{" "}
                    {formatBytes(
                      transmit
                    )}
                    /s émission
                  </div>

                </div>
              );
            }
          )}

          {extractResult(
            network?.receive
          ).length === 0 && (
            <div className="empty-state">
              Aucune donnée réseau
              disponible.
            </div>
          )}

        </div>
      </section>

      {/* ===================================================
          PROMETHEUS TARGETS
      =================================================== */}

      <section className="prometheus-section">

        <div className="prometheus-section-title">
          <Target size={20} />

          <div>
            <h2>
              Cibles Prometheus
            </h2>

            <p>
              État des différentes cibles
              surveillées.
            </p>
          </div>
        </div>

        <div className="prometheus-targets-grid">

          {targets.map(
            (target, index) => (
              <TargetCard
                key={`target-${
                  target?.scrapePool ||
                  target?.labels?.job ||
                  "pool"
                }-${
                  target?.scrapeUrl ||
                  target?.labels?.instance ||
                  "instance"
                }-${index}`}
                target={target}
              />
            )
          )}

          {targets.length === 0 && (
            <div className="empty-state">
              Aucune cible Prometheus
              disponible.
            </div>
          )}

        </div>
      </section>

      {/* ===================================================
          FOOTER
      =================================================== */}

      <div className="prometheus-footer">

        <Activity size={16} />

        <span>
          HorizonOps — Supervision
          basée sur Prometheus
        </span>

      </div>

    </div>
  );
}