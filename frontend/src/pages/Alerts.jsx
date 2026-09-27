import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  XCircle,
  Activity,
  Play,
  X,
} from "lucide-react";

import { apiFetch } from "../api";

const API_BASE = "/monitoring";

/* =========================================================
   NORMALISATION DES RÉPONSES
========================================================= */

function normalizeArray(data) {
  if (!data) {
    return [];
  }

  // Tableau direct
  if (Array.isArray(data)) {
    return data;
  }

  // DRF pagination
  if (Array.isArray(data.results)) {
    return data.results;
  }

  // { data: [...] }
  if (Array.isArray(data.data)) {
    return data.data;
  }

  // { data: { results: [...] } }
  if (
    data.data &&
    Array.isArray(data.data.results)
  ) {
    return data.data.results;
  }

  // { alerts: [...] }
  if (Array.isArray(data.alerts)) {
    return data.alerts;
  }

  // { rules: [...] }
  if (Array.isArray(data.rules)) {
    return data.rules;
  }

  // { history: [...] }
  if (Array.isArray(data.history)) {
    return data.history;
  }

  // { data: { alerts: [...] } }
  if (
    data.data &&
    Array.isArray(data.data.alerts)
  ) {
    return data.data.alerts;
  }

  // { data: { rules: [...] } }
  if (
    data.data &&
    Array.isArray(data.data.rules)
  ) {
    return data.data.rules;
  }

  return [];
}

/* =========================================================
   LECTURE DE LA RÉPONSE HTTP
========================================================= */

async function parseApiResponse(response) {
  if (!response) {
    throw new Error(
      "Aucune réponse reçue du serveur."
    );
  }

  if (!response.ok) {
    let message = `Erreur HTTP ${response.status}`;

    try {
      const errorData = await response.json();

      message =
        errorData?.detail ||
        errorData?.message ||
        errorData?.error ||
        message;
    } catch {
      // La réponse d'erreur n'est pas du JSON
    }

    throw new Error(message);
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (
    contentType.includes("application/json")
  ) {
    return await response.json();
  }

  return null;
}

/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/* =========================================================
   FORMAT VALEUR
========================================================= */

function formatValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toFixed(2);
}

/* =========================================================
   LABEL MÉTRIQUE
========================================================= */

function getMetricLabel(metric) {
  switch (
    String(metric || "").toLowerCase()
  ) {
    case "cpu":
      return "CPU";

    case "memory":
    case "ram":
      return "Mémoire RAM";

    case "storage":
    case "disk":
      return "Disque";

    case "network":
      return "Réseau";

    default:
      return metric || "—";
  }
}

/* =========================================================
   UNITÉ MÉTRIQUE
========================================================= */

function getMetricUnit(metric) {
  switch (
    String(metric || "").toLowerCase()
  ) {
    case "cpu":
    case "memory":
    case "ram":
    case "storage":
    case "disk":
      return "%";

    default:
      return "";
  }
}

/* =========================================================
   CLASSE SÉVÉRITÉ
========================================================= */

function getSeverityClass(severity) {
  switch (
    String(severity || "").toLowerCase()
  ) {
    case "critical":
      return "alert-severity-critical";

    case "warning":
      return "alert-severity-warning";

    case "info":
      return "alert-severity-info";

    default:
      return "alert-severity-default";
  }
}

/* =========================================================
   LABEL SÉVÉRITÉ
========================================================= */

function getSeverityLabel(severity) {
  switch (
    String(severity || "").toLowerCase()
  ) {
    case "critical":
      return "Critique";

    case "warning":
      return "Avertissement";

    case "info":
      return "Information";

    default:
      return severity || "—";
  }
}

/* =========================================================
   CLASSE STATUS
========================================================= */

function getStatusClass(status) {
  switch (
    String(status || "").toLowerCase()
  ) {
    case "firing":
      return "alert-status-firing";

    case "resolved":
      return "alert-status-resolved";

    default:
      return "alert-status-default";
  }
}

/* =========================================================
   LABEL STATUS
========================================================= */

function getStatusLabel(status) {
  switch (
    String(status || "").toLowerCase()
  ) {
    case "firing":
      return "Déclenchée";

    case "resolved":
      return "Résolue";

    default:
      return status || "Inconnu";
  }
}

/* =========================================================
   COMPOSANT ALERTS
========================================================= */

export default function Alerts() {
  const [activeAlerts, setActiveAlerts] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [rules, setRules] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [evaluating, setEvaluating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState("active");

  const [notifications, setNotifications] =
    useState([]);

  /* =======================================================
     NOTIFICATION
  ======================================================= */

  const addNotification = useCallback(
    (alert) => {
      const notification = {
        id: `${Date.now()}-${
          alert.id || Math.random()
        }`,

        title:
          alert.rule_name ||
          alert.rule?.name ||
          alert.rule ||
          "Alerte système",

        message:
          alert.message ||
          "Une nouvelle alerte a été détectée.",

        severity:
          alert.severity || "warning",
      };

      setNotifications((current) => [
        notification,
        ...current,
      ]);

      setTimeout(() => {
        setNotifications((current) =>
          current.filter(
            (item) =>
              item.id !== notification.id
          )
        );
      }, 7000);
    },
    []
  );

  /* =======================================================
     CHARGER LES DONNÉES
  ======================================================= */

  const loadAlerts = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        /*
         * On récupère d'abord les réponses HTTP.
         */
        const [
          activeResponse,
          historyResponse,
          rulesResponse,
        ] = await Promise.all([
          apiFetch(
            `${API_BASE}/alerts/active/`
          ),

          apiFetch(
            `${API_BASE}/alerts/history/`
          ),

          apiFetch(
            `${API_BASE}/alerts/rules/`
          ),
        ]);

        /*
         * IMPORTANT :
         * apiFetch retourne Response.
         *
         * Il faut donc convertir chaque réponse
         * en JSON avant normalizeArray().
         */
        const [
          activeData,
          historyData,
          rulesData,
        ] = await Promise.all([
          parseApiResponse(activeResponse),

          parseApiResponse(historyResponse),

          parseApiResponse(rulesResponse),
        ]);

        /* DEBUG */
        console.log(
          "ALERTES ACTIVES API :",
          activeData
        );

        console.log(
          "HISTORIQUE ALERTES API :",
          historyData
        );

        console.log(
          "RÈGLES ALERTES API :",
          rulesData
        );

        /*
         * Normalisation
         */
        const normalizedActive =
          normalizeArray(activeData);

        const normalizedHistory =
          normalizeArray(historyData);

        const normalizedRules =
          normalizeArray(rulesData);

        console.log(
          "ALERTES ACTIVES NORMALISÉES :",
          normalizedActive
        );

        console.log(
          "HISTORIQUE NORMALISÉ :",
          normalizedHistory
        );

        console.log(
          "RÈGLES NORMALISÉES :",
          normalizedRules
        );

        /*
         * Mise à jour du state
         */
        setActiveAlerts(
          normalizedActive
        );

        setHistory(
          normalizedHistory
        );

        setRules(
          normalizedRules
        );
      } catch (err) {
        console.error(
          "Erreur chargement alertes :",
          err
        );

        setError(
          err?.message ||
            "Impossible de charger les données de supervision."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /* =======================================================
     CHARGEMENT INITIAL
  ======================================================= */

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  /* =======================================================
     ÉVALUATION DES ALERTES
  ======================================================= */

  const evaluateAlerts = async () => {
    setEvaluating(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API_BASE}/alerts/evaluate/`,
        {
          method: "POST",
        }
      );

      const result =
        await parseApiResponse(response);

      console.log(
        "RÉSULTAT ÉVALUATION ALERTES :",
        result
      );

      const evaluationResults =
        normalizeArray(result);

      evaluationResults.forEach(
        (item) => {
          const results = Array.isArray(
            item?.results
          )
            ? item.results
            : [];

          results.forEach(
            (alertResult) => {
              if (
                alertResult?.triggered ===
                  true &&
                alertResult?.action ===
                  "triggered"
              ) {
                addNotification({
                  id: item.rule_id,

                  rule_name:
                    item.rule,

                  target_name:
                    item.target,

                  message:
                    alertResult.message,

                  severity:
                    item.severity ||
                    "warning",
                });
              }
            }
          );
        }
      );

      /*
       * Recharge les alertes, l'historique
       * et les règles après l'évaluation.
       */
      await loadAlerts();
    } catch (err) {
      console.error(
        "Erreur évaluation alertes :",
        err
      );

      setError(
        err?.message ||
          "Impossible d'évaluer les règles d'alerte."
      );
    } finally {
      setEvaluating(false);
    }
  };

  /* =======================================================
     STATISTIQUES
  ======================================================= */

  const statistics = useMemo(() => {
    const firing =
      activeAlerts.filter(
        (alert) =>
          String(
            alert?.status || ""
          ).toLowerCase() ===
          "firing"
      ).length;

    const resolved =
      history.filter(
        (alert) =>
          String(
            alert?.status || ""
          ).toLowerCase() ===
          "resolved"
      ).length;

    const enabledRules =
      rules.filter(
        (rule) =>
          rule?.enabled === true
      ).length;

    return {
      active: firing,
      history: history.length,
      resolved,
      rules: rules.length,
      enabledRules,
    };
  }, [
    activeAlerts,
    history,
    rules,
  ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="alerts-page">

      {/* =================================================
          NOTIFICATIONS
      ================================================= */}

      <div className="alerts-notification-container">
        {notifications.map(
          (notification) => (
            <div
              className="alerts-notification"
              key={notification.id}
            >
              <div className="alerts-notification-icon">
                <AlertTriangle size={20} />
              </div>

              <div className="alerts-notification-content">
                <strong>
                  {notification.title}
                </strong>

                <p>
                  {notification.message}
                </p>
              </div>

              <button
                className="alerts-notification-close"
                onClick={() =>
                  setNotifications(
                    (current) =>
                      current.filter(
                        (item) =>
                          item.id !==
                          notification.id
                      )
                  )
                }
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          )
        )}
      </div>

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="alerts-page-header">

        <div>
          <div className="alerts-title-row">

            <div className="alerts-title-icon">
              <Bell size={24} />
            </div>

            <div>
              <h1>
                Alertes
              </h1>

              <p>
                Surveillance des alertes et
                des règles de supervision
              </p>
            </div>

          </div>
        </div>

        <div className="alerts-header-actions">

          <button
            className="alerts-refresh-button"
            onClick={loadAlerts}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "alerts-spin"
                  : ""
              }
            />

            Actualiser
          </button>

          <button
            className="alerts-evaluate-button"
            onClick={evaluateAlerts}
            disabled={evaluating}
          >
            <Play size={17} />

            {evaluating
              ? "Évaluation..."
              : "Évaluer les alertes"}
          </button>

        </div>
      </div>

      {/* =================================================
          ERREUR
      ================================================= */}

      {error && (
        <div className="alerts-error">

          <XCircle size={19} />

          <div>
            <strong>
              Erreur
            </strong>

            <p>
              {error}
            </p>
          </div>

        </div>
      )}

      {/* =================================================
          STATISTIQUES
      ================================================= */}

      <div className="alerts-statistics-grid">

        <div className="alerts-stat-card">

          <div className="alerts-stat-icon alerts-stat-danger">
            <ShieldAlert size={22} />
          </div>

          <div>
            <span>
              Alertes actives
            </span>

            <strong>
              {statistics.active}
            </strong>
          </div>

        </div>

        <div className="alerts-stat-card">

          <div className="alerts-stat-icon alerts-stat-history">
            <Clock3 size={22} />
          </div>

          <div>
            <span>
              Historique
            </span>

            <strong>
              {statistics.history}
            </strong>
          </div>

        </div>

        <div className="alerts-stat-card">

          <div className="alerts-stat-icon alerts-stat-success">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <span>
              Alertes résolues
            </span>

            <strong>
              {statistics.resolved}
            </strong>
          </div>

        </div>

        <div className="alerts-stat-card">

          <div className="alerts-stat-icon alerts-stat-rules">
            <Activity size={22} />
          </div>

          <div>
            <span>
              Règles actives
            </span>

            <strong>
              {statistics.enabledRules}/
              {statistics.rules}
            </strong>
          </div>

        </div>

      </div>

      {/* =================================================
          ONGLETS
      ================================================= */}

      <div className="alerts-tabs">

        <button
          className={
            activeTab === "active"
              ? "alerts-tab active"
              : "alerts-tab"
          }
          onClick={() =>
            setActiveTab("active")
          }
        >
          <ShieldAlert size={17} />

          Alertes actives

          <span>
            {activeAlerts.length}
          </span>
        </button>

        <button
          className={
            activeTab === "history"
              ? "alerts-tab active"
              : "alerts-tab"
          }
          onClick={() =>
            setActiveTab("history")
          }
        >
          <Clock3 size={17} />

          Historique

          <span>
            {history.length}
          </span>
        </button>

        <button
          className={
            activeTab === "rules"
              ? "alerts-tab active"
              : "alerts-tab"
          }
          onClick={() =>
            setActiveTab("rules")
          }
        >
          <Activity size={17} />

          Règles

          <span>
            {rules.length}
          </span>
        </button>

      </div>

      {/* =================================================
          CONTENU
      ================================================= */}

      <div className="alerts-content">

        {loading ? (
          <div className="alerts-empty">

            <RefreshCw
              className="alerts-spin"
              size={28}
            />

            <p>
              Chargement des alertes...
            </p>

          </div>
        ) : (
          <>

            {/* ============================================
                ALERTES ACTIVES
            ============================================ */}

            {activeTab === "active" && (
              <section className="alerts-section">

                <div className="alerts-section-header">

                  <div>
                    <h2>
                      Alertes actives
                    </h2>

                    <p>
                      Alertes actuellement
                      déclenchées par le système
                    </p>
                  </div>

                  <span className="alerts-count-badge">
                    {activeAlerts.length}
                  </span>

                </div>

                {activeAlerts.length ===
                0 ? (
                  <div className="alerts-empty">

                    <CheckCircle2 size={38} />

                    <h3>
                      Aucune alerte active
                    </h3>

                    <p>
                      Toutes les règles de
                      supervision sont
                      actuellement dans un
                      état normal.
                    </p>

                  </div>
                ) : (
                  <div className="alerts-list">

                    {activeAlerts.map(
                      (
                        alert,
                        index
                      ) => {
                        const metric =
                          alert.metric ||
                          alert.rule?.metric;

                        const unit =
                          getMetricUnit(
                            metric
                          );

                        return (
                          <div
                            className="alert-card alert-card-active"
                            key={
                              alert.id ||
                              `active-alert-${index}`
                            }
                          >

                            <div className="alert-card-icon">
                              <AlertTriangle
                                size={23}
                              />
                            </div>

                            <div className="alert-card-main">

                              <div className="alert-card-header">

                                <div>

                                  <h3>
                                    {alert.rule_name ||
                                      alert.rule?.name ||
                                      alert.rule ||
                                      "Alerte"}
                                  </h3>

                                  <span className="alert-target">
                                    {alert.target_name ||
                                      alert.target?.name ||
                                      "Cible inconnue"}
                                  </span>

                                </div>

                                <span
                                  className={`alert-status ${getStatusClass(
                                    alert.status
                                  )}`}
                                >
                                  {getStatusLabel(
                                    alert.status
                                  )}
                                </span>

                              </div>

                              <div className="alert-card-details">

                                <div>
                                  <span>
                                    Métrique
                                  </span>

                                  <strong>
                                    {getMetricLabel(
                                      metric
                                    )}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Valeur
                                  </span>

                                  <strong>
                                    {formatValue(
                                      alert.value
                                    )}

                                    {unit && (
                                      <small>
                                        {" "}
                                        {unit}
                                      </small>
                                    )}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Déclenchée
                                  </span>

                                  <strong>
                                    {formatDate(
                                      alert.triggered_at
                                    )}
                                  </strong>
                                </div>

                              </div>

                              {alert.message && (
                                <div className="alert-message">
                                  {alert.message}
                                </div>
                              )}

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </section>
            )}

            {/* ============================================
                HISTORIQUE
            ============================================ */}

            {activeTab === "history" && (
              <section className="alerts-section">

                <div className="alerts-section-header">

                  <div>
                    <h2>
                      Historique des alertes
                    </h2>

                    <p>
                      Historique des
                      déclenchements et
                      résolutions
                    </p>
                  </div>

                  <span className="alerts-count-badge">
                    {history.length}
                  </span>

                </div>

                {history.length ===
                0 ? (
                  <div className="alerts-empty">

                    <Clock3 size={38} />

                    <h3>
                      Aucun historique
                    </h3>

                    <p>
                      Aucune alerte n'a encore
                      été enregistrée.
                    </p>

                  </div>
                ) : (
                  <div className="alerts-history-table-wrapper">

                    <table className="alerts-history-table">

                      <thead>
                        <tr>
                          <th>
                            Règle
                          </th>

                          <th>
                            Cible
                          </th>

                          <th>
                            Métrique
                          </th>

                          <th>
                            Valeur
                          </th>

                          <th>
                            Statut
                          </th>

                          <th>
                            Déclenchée
                          </th>

                          <th>
                            Résolue
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {history.map(
                          (
                            alert,
                            index
                          ) => {
                            const metric =
                              alert.metric ||
                              alert.rule?.metric;

                            const unit =
                              getMetricUnit(
                                metric
                              );

                            return (
                              <tr
                                key={
                                  alert.id ||
                                  `history-alert-${index}`
                                }
                              >

                                <td>
                                  <strong>
                                    {alert.rule_name ||
                                      alert.rule?.name ||
                                      alert.rule ||
                                      "—"}
                                  </strong>
                                </td>

                                <td>
                                  {alert.target_name ||
                                    alert.target?.name ||
                                    "—"}
                                </td>

                                <td>
                                  {getMetricLabel(
                                    metric
                                  )}
                                </td>

                                <td>
                                  {formatValue(
                                    alert.value
                                  )}

                                  {unit
                                    ? ` ${unit}`
                                    : ""}
                                </td>

                                <td>
                                  <span
                                    className={`alert-status ${getStatusClass(
                                      alert.status
                                    )}`}
                                  >
                                    {getStatusLabel(
                                      alert.status
                                    )}
                                  </span>
                                </td>

                                <td>
                                  {formatDate(
                                    alert.triggered_at
                                  )}
                                </td>

                                <td>
                                  {formatDate(
                                    alert.resolved_at
                                  )}
                                </td>

                              </tr>
                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>
                )}

              </section>
            )}

            {/* ============================================
                RÈGLES
            ============================================ */}

            {activeTab === "rules" && (
              <section className="alerts-section">

                <div className="alerts-section-header">

                  <div>
                    <h2>
                      Règles d'alerte
                    </h2>

                    <p>
                      Règles utilisées pour
                      détecter les anomalies
                    </p>
                  </div>

                  <span className="alerts-count-badge">
                    {rules.length}
                  </span>

                </div>

                {rules.length ===
                0 ? (
                  <div className="alerts-empty">

                    <Activity size={38} />

                    <h3>
                      Aucune règle
                    </h3>

                    <p>
                      Aucune règle d'alerte
                      n'est configurée.
                    </p>

                  </div>
                ) : (
                  <div className="alerts-rules-grid">

                    {rules.map(
                      (
                        rule,
                        index
                      ) => {
                        const metric =
                          rule.metric;

                        const unit =
                          getMetricUnit(
                            metric
                          );

                        return (
                          <div
                            className="alert-rule-card"
                            key={
                              rule.id ||
                              `alert-rule-${index}`
                            }
                          >

                            <div className="alert-rule-header">

                              <div className="alert-rule-icon">
                                <Activity
                                  size={20}
                                />
                              </div>

                              <span
                                className={`alert-severity ${getSeverityClass(
                                  rule.severity
                                )}`}
                              >
                                {getSeverityLabel(
                                  rule.severity
                                )}
                              </span>

                            </div>

                            <h3>
                              {rule.name ||
                                "Règle sans nom"}
                            </h3>

                            <div className="alert-rule-info">

                              <div>
                                <span>
                                  Cible
                                </span>

                                <strong>
                                  {rule.target_name ||
                                    rule.target?.name ||
                                    "—"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Type de cible
                                </span>

                                <strong>
                                  {rule.target_type ||
                                    rule.target?.target_type ||
                                    "—"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Métrique
                                </span>

                                <strong>
                                  {getMetricLabel(
                                    metric
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Condition
                                </span>

                                <strong>
                                  {rule.condition ||
                                    "—"}{" "}
                                  {formatValue(
                                    rule.threshold
                                  )}

                                  {unit
                                    ? ` ${unit}`
                                    : ""}
                                </strong>
                              </div>

                            </div>

                            <div className="alert-rule-footer">

                              <span
                                className={
                                  rule.enabled
                                    ? "rule-enabled"
                                    : "rule-disabled"
                                }
                              >
                                <span className="rule-status-dot" />

                                {rule.enabled
                                  ? "Activée"
                                  : "Désactivée"}
                              </span>

                              <span>
                                {formatDate(
                                  rule.updated_at ||
                                    rule.created_at
                                )}
                              </span>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </section>
            )}

          </>
        )}

      </div>
    </div>
  );
}