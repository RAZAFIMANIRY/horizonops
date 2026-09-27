import os
import requests


class PrometheusService:
    """
    Service d'accès à Prometheus pour HorizonOps.

    Architecture :

        Ordinateur principal
            └── Node Exporter
                └── job="horizonops-node"

        Serveur Proxmox
            IP : 192.168.100.2
            └── PVE Exporter
                └── job="proxmox"

    Les métriques du dashboard Proxmox utilisent
    exclusivement la cible job="proxmox".
    """

    def __init__(self):
        host = os.getenv(
            "PROMETHEUS_HOST",
            "127.0.0.1",
        )

        port = os.getenv(
            "PROMETHEUS_PORT",
            "9090",
        )

        self.base_url = (
            f"http://{host}:{port}/api/v1"
        )

        self.proxmox_job = os.getenv(
            "PROMETHEUS_PROXMOX_JOB",
            "proxmox",
        )

        self.proxmox_ip = os.getenv(
            "PROXMOX_IP",
            "192.168.100.2",
        )

    # =========================================================
    # REQUÊTE PROMETHEUS
    # =========================================================

    def _request(
        self,
        endpoint,
        params=None,
    ):
        url = f"{self.base_url}/{endpoint}"

        try:
            response = requests.get(
                url,
                params=params,
                timeout=10,
            )

            response.raise_for_status()

        except requests.RequestException as exc:
            raise RuntimeError(
                f"Impossible de joindre Prometheus : {exc}"
            ) from exc

        try:
            data = response.json()

        except ValueError as exc:
            raise RuntimeError(
                "Prometheus a retourné une réponse JSON invalide."
            ) from exc

        if data.get("status") != "success":
            raise RuntimeError(
                data.get(
                    "error",
                    "Prometheus a retourné une erreur.",
                )
            )

        return data.get("data")

    # =========================================================
    # API PROMETHEUS
    # =========================================================

    def query(self, query):
        return self._request(
            "query",
            params={
                "query": query,
            },
        )

    def query_range(
        self,
        query,
        start,
        end,
        step="15s",
    ):
        return self._request(
            "query_range",
            params={
                "query": query,
                "start": start,
                "end": end,
                "step": step,
            },
        )

    def get_targets(self):
        return self._request(
            "targets"
        )

    def get_alerts(self):
        return self._request(
            "alerts"
        )

    def get_rules(self):
        return self._request(
            "rules"
        )

    def get_series(self, match):
        return self._request(
            "series",
            params={
                "match[]": match,
            },
        )

    def get_label_values(self, label):
        return self._request(
            f"label/{label}/values"
        )

    def get_metric(self, metric):
        return self.query(metric)

    # =========================================================
    # OVERVIEW
    # =========================================================

    def get_overview(self):
        prometheus_available = False
        proxmox_available = False

        try:
            result = self.query("up")

            prometheus_available = True

            if isinstance(result, dict):

                values = result.get(
                    "result",
                    [],
                )

                for item in values:

                    metric = item.get(
                        "metric",
                        {},
                    )

                    job = str(
                        metric.get(
                            "job",
                            "",
                        )
                    ).lower()

                    instance = str(
                        metric.get(
                            "instance",
                            "",
                        )
                    ).lower()

                    value = item.get(
                        "value",
                        [None, "0"],
                    )

                    if len(value) < 2:
                        continue

                    is_proxmox = (
                        job == self.proxmox_job.lower()
                        or "proxmox" in job
                        or "pve" in job
                        or self.proxmox_ip in instance
                        or "proxmox" in instance
                        or "pve-exporter" in instance
                    )

                    if (
                        is_proxmox
                        and value[1] == "1"
                    ):
                        proxmox_available = True

        except Exception:
            pass

        return {
            "prometheus": {
                "available": prometheus_available,
            },
            "proxmox": {
                "available": proxmox_available,
                "ip": self.proxmox_ip,
            },
        }

    # =========================================================
    # CPU PROXMOX
    # =========================================================

    def get_cpu_metrics(self):
        """
        CPU du serveur Proxmox.

        pve_cpu_usage_ratio :
            0.25 = 25 %
            0.50 = 50 %
            0.80 = 80 %

        On convertit donc le ratio en pourcentage.
        """

        queries = [

            (
                f'pve_cpu_usage_ratio'
                f'{{job="{self.proxmox_job}"}} * 100'
            ),

            (
                f'pve_cpu_usage_percent'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        for query in queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    return {
                        "available": True,
                        "result": data["result"],
                    }

            except Exception:
                continue

        return {
            "available": False,
            "result": [],
        }

    # =========================================================
    # MÉMOIRE PROXMOX
    # =========================================================

    def get_memory_metrics(self):
        """
        RAM du serveur Proxmox.

        IMPORTANT :
        On n'utilise plus :

            node_memory_MemTotal_bytes
            node_memory_MemAvailable_bytes

        car ces métriques viennent du Node Exporter
        de l'ordinateur principal.

        Ici on utilise les métriques PVE.
        """

        usage_queries = [

            (
                f'pve_memory_usage_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),

            (
                f'pve_mem_usage_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        size_queries = [

            (
                f'pve_memory_size_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),

            (
                f'pve_mem_total_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        usage = []
        size = []

        for query in usage_queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    usage = data["result"]
                    break

            except Exception:
                continue

        for query in size_queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    size = data["result"]
                    break

            except Exception:
                continue

        return {
            "available": bool(
                usage or size
            ),
            "usage": usage,
            "size": size,
        }

    # =========================================================
    # STOCKAGE PROXMOX
    # =========================================================

    def get_storage_metrics(self):
        """
        Stockage Proxmox.

        Les noms exacts dépendent de la version
        de PVE Exporter.
        """

        size_queries = [

            (
                f'pve_disk_size_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),

            (
                f'pve_storage_size_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        usage_queries = [

            (
                f'pve_disk_usage_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),

            (
                f'pve_storage_usage_bytes'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        size = []
        usage = []

        for query in size_queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    size = data["result"]
                    break

            except Exception:
                continue

        for query in usage_queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    usage = data["result"]
                    break

            except Exception:
                continue

        return {
            "available": bool(
                size or usage
            ),
            "size": size,
            "usage": usage,
        }

    # =========================================================
    # RÉSEAU PROXMOX
    # =========================================================

    def get_network_metrics(self):
        """
        Trafic réseau Proxmox.
        """

        receive_queries = [

            (
                f'rate('
                f'pve_network_receive_bytes_total'
                f'{{job="{self.proxmox_job}"}}'
                f'[5m])'
            ),

            (
                f'pve_network_receive_bytes_total'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        transmit_queries = [

            (
                f'rate('
                f'pve_network_transmit_bytes_total'
                f'{{job="{self.proxmox_job}"}}'
                f'[5m])'
            ),

            (
                f'pve_network_transmit_bytes_total'
                f'{{job="{self.proxmox_job}"}}'
            ),
        ]

        receive = []
        transmit = []

        for query in receive_queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    receive = data["result"]
                    break

            except Exception:
                continue

        for query in transmit_queries:

            try:

                data = self.query(query)

                if (
                    data
                    and data.get("result")
                ):
                    transmit = data["result"]
                    break

            except Exception:
                continue

        return {
            "available": bool(
                receive or transmit
            ),
            "receive": receive,
            "transmit": transmit,
        }

    # =========================================================
    # HISTORIQUE CPU
    # =========================================================

    def get_cpu_history(
        self,
        start,
        end,
        step="15s",
    ):
        """
        Historique CPU Proxmox.

        Résultat :
            0 à 100 %
        """

        query = (
            f'pve_cpu_usage_ratio'
            f'{{job="{self.proxmox_job}"}} * 100'
        )

        try:

            data = self.query_range(
                query=query,
                start=start,
                end=end,
                step=step,
            )

            if (
                data
                and data.get("result")
            ):
                return data

        except Exception as exc:

            print(
                "[Prometheus] "
                f"Erreur historique CPU : {exc}"
            )

        return {
            "resultType": "matrix",
            "result": [],
        }

    # =========================================================
    # HISTORIQUE MÉMOIRE
    # =========================================================

    def get_memory_history(
        self,
        start,
        end,
        step="15s",
    ):
        """
        Historique RAM Proxmox.

        Résultat :
            0 à 100 %
        """

        query = (
            f'('
            f'pve_memory_usage_bytes'
            f'{{job="{self.proxmox_job}"}}'
            f' / '
            f'pve_memory_size_bytes'
            f'{{job="{self.proxmox_job}"}}'
            f') * 100'
        )

        try:

            data = self.query_range(
                query=query,
                start=start,
                end=end,
                step=step,
            )

            if (
                data
                and data.get("result")
            ):
                return data

        except Exception as exc:

            print(
                "[Prometheus] "
                f"Erreur historique mémoire : {exc}"
            )

        return {
            "resultType": "matrix",
            "result": [],
        }