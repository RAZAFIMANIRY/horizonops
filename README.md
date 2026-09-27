# HorizonOps

> Plateforme de gestion d'infrastructure réseau cloud basée sur des technologies open source

## 📋 Description

HorizonOps est une plateforme web centralisée permettant à un administrateur de gérer et de superviser une infrastructure réseau cloud privée depuis une interface unique. Elle repose exclusivement sur des technologies open source et fonctionne dans un environnement à ressources limitées (8 Go de RAM).

## 🎯 Fonctionnalités

- **Authentification** : gestion des utilisateurs et des rôles (Administrateur / Standard)
- **Gestion des VMs et conteneurs** : création, démarrage, arrêt, suppression via Proxmox VE
- **Gestion du réseau virtuel** : configuration des bridges et VLANs via Open vSwitch
- **Gestion du VPN** : création et supervision de tunnels WireGuard
- **Supervision** : collecte et visualisation des métriques via Prometheus et Recharts
- **Alertes** : configuration de seuils et notifications en temps réel

## 🛠️ Technologies utilisées

### Backend
- Python 3.x, Django, Django REST Framework
- Django Channels (WebSocket), PostgreSQL, Redis

### Frontend
- React.js, Recharts, JavaScript, HTML, CSS

### Infrastructure
- Proxmox VE (KVM, LXC), Open vSwitch, WireGuard, Prometheus

## 📁 Structure du projet

horizonops/
├── backend/ # Backend Django REST Framework
│ ├── auth_api/ # Authentification
│ ├── docker_api/ # Gestion Docker
│ ├── monitoring/ # Supervision et alertes
│ ├── network/ # Réseau virtuel
│ ├── vms/ # Machines virtuelles et conteneurs
│ ├── vpn/ # VPN WireGuard
│ └── horizonops/ # Configuration principale
├── frontend/ # Frontend React
│ └── src/
│ ├── pages/ # Pages de l'interface
│ └── assets/ # Ressources
├── docker-compose.yml # Configuration Docker
├── prometheus.yml # Configuration Prometheus
└── pve.yml # Configuration Proxmox VE


## 🚀 Installation

### Prérequis
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Proxmox VE (pour l'infrastructure)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

cd frontend
npm install
npm run dev

docker-compose up -d
