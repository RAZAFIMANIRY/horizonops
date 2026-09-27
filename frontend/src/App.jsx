import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LayoutDashboard,
  Server,
  Container,
  Network,
  ShieldCheck,
  Activity,
  Clock3,
  Menu,
  Bell,
  Moon,
  Sun,
  LogOut,
  User,
} from "lucide-react";

import Dashboard from "./pages/Dashboard";
import Docker from "./pages/Docker";
import Proxmox from "./pages/Proxmox";
import OVS from "./pages/OVS";
import WireGuard from "./pages/WireGuard";
import Prometheus from "./pages/Prometheus";
import Login from "./pages/Login";
import Alerts from "./pages/Alerts";
import Users from "./pages/User";
import UserDashboard from "./pages/UserDashboard";

import { apiFetch } from "./api";


/*
|--------------------------------------------------------------------------
| NAVIGATION ADMIN
|--------------------------------------------------------------------------
*/

const navigation = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Proxmox VE",
    path: "/proxmox",
    icon: Server,
  },
  {
    name: "Docker",
    path: "/docker",
    icon: Container,
  },
  {
    name: "Open vSwitch",
    path: "/ovs",
    icon: Network,
  },
  {
    name: "WireGuard VPN",
    path: "/wireguard",
    icon: ShieldCheck,
  },
  {
    name: "Prometheus",
    path: "/prometheus",
    icon: Activity,
  },
  {
    name: "Alertes",
    path: "/alerts",
    icon: Bell,
  },
  {
    name: "Users",
    path: "/users",
    icon: User,
  },
];


/*
|--------------------------------------------------------------------------
| RÔLE
|--------------------------------------------------------------------------
*/

const getUserRole = (user) => {
  return String(user?.role || "").toLowerCase();
};


/*
|--------------------------------------------------------------------------
| ROUTES PROTÉGÉES
|--------------------------------------------------------------------------
*/

function ProtectedRoutes({
  user,
  onLogout,
}) {
  const role = getUserRole(user);

  /*
  |--------------------------------------------------------------------------
  | UTILISATEUR STANDARD
  |--------------------------------------------------------------------------
  */

  if (role === "user") {
    return (
      <Routes>

        <Route
          path="/user-dashboard"
          element={
            <UserDashboard
              onLogout={onLogout}
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/user-dashboard"
              replace
            />
          }
        />

      </Routes>
    );
  }


  /*
  |--------------------------------------------------------------------------
  | ADMINISTRATEUR
  |--------------------------------------------------------------------------
  */

  if (role === "admin") {
    return (
      <AdminLayout
        user={user}
        onLogout={onLogout}
      />
    );
  }


  /*
  |--------------------------------------------------------------------------
  | RÔLE INCONNU
  |--------------------------------------------------------------------------
  */

  return (
    <Routes>

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

    </Routes>
  );
}


/*
|--------------------------------------------------------------------------
| LAYOUT ADMIN
|--------------------------------------------------------------------------
*/

function AdminLayout({
  user,
  onLogout,
}) {

  const [theme, setTheme] = useState(() => {
    return (
      localStorage.getItem(
        "horizonops-theme"
      ) || "dark"
    );
  });

  const navigate = useNavigate();
  const location = useLocation();


  /*
  |--------------------------------------------------------------------------
  | THÈME
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    localStorage.setItem(
      "horizonops-theme",
      theme
    );

  }, [theme]);


  /*
  |--------------------------------------------------------------------------
  | VÉRIFICATION DU RÔLE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    const role = getUserRole(user);

    if (role !== "admin") {

      navigate(
        "/user-dashboard",
        {
          replace: true,
        }
      );

    }

  }, [user, navigate]);


  /*
  |--------------------------------------------------------------------------
  | THÈME
  |--------------------------------------------------------------------------
  */

  const toggleTheme = () => {

    setTheme(
      (currentTheme) =>
        currentTheme === "dark"
          ? "light"
          : "dark"
    );

  };


  /*
  |--------------------------------------------------------------------------
  | DÉCONNEXION ADMIN
  |--------------------------------------------------------------------------
  */

  const handleLogoutClick = async () => {

    await onLogout();

  };


  /*
  |--------------------------------------------------------------------------
  | RENDU
  |--------------------------------------------------------------------------
  */

  return (
    <div className="app-shell">

      {/* ================================================================
          SIDEBAR
      ================================================================= */}

      <aside className="sidebar">

        <div className="logo-area">

          <div className="logo-mark">

            <div className="logo-node node-top" />
            <div className="logo-node node-left" />
            <div className="logo-node node-right" />
            <div className="logo-node node-bottom" />

            <div className="logo-center" />

          </div>


          <div>

            <h1>
              HorizonOps
            </h1>

            <span>
              Infrastructure Control
            </span>

          </div>

        </div>


        {/* NAVIGATION */}

        <div className="sidebar-section">

          <span className="section-label">
            COMMAND CENTER
          </span>


          <nav>

            {navigation.map((item) => {

              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `nav-item ${
                      isActive
                        ? "active"
                        : ""
                    }`
                  }
                >

                  <Icon size={19} />

                  <span>
                    {item.name}
                  </span>

                </NavLink>
              );

            })}

          </nav>

        </div>


        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <div className="system-status">

            <div className="status-dot" />

            <div>

              <strong>
                System Online
              </strong>

              <span>
                All services operational
              </span>

            </div>

          </div>


          <div className="sidebar-version">
            HorizonOps v1.0.0
          </div>

        </div>

      </aside>


      {/* ================================================================
          MAIN
      ================================================================= */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">

          <div className="topbar-left">

            <button
              className="mobile-menu"
              type="button"
              aria-label="Menu"
            >
              <Menu size={20} />
            </button>


            <div>

              <span className="breadcrumb">
                HORIZONOPS / INFRASTRUCTURE
              </span>

              <h2>
                Command Center
              </h2>

            </div>

          </div>


          {/* TOPBAR RIGHT */}

          <div className="topbar-right">

            <div className="live-indicator">

              <span />

              LIVE

            </div>


            <div className="topbar-time">

              <Clock3 size={16} />

              <span>
                {new Date().toLocaleTimeString()}
              </span>

            </div>


            {/* THEME */}

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              title={
                theme === "dark"
                  ? "Passer au mode clair"
                  : "Passer au mode sombre"
              }
              aria-label={
                theme === "dark"
                  ? "Passer au mode clair"
                  : "Passer au mode sombre"
              }
            >

              {theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}

            </button>


            {/* NOTIFICATIONS */}

            <button
              type="button"
              className="icon-button"
              title="Notifications"
              aria-label="Notifications"
            >

              <Bell size={18} />

            </button>


            {/* UTILISATEUR */}

            <div
              className="user-avatar"
              title={user?.username || ""}
            >

              {user?.username
                ? user.username
                    .charAt(0)
                    .toUpperCase()
                : "A"}

            </div>


            {/* LOGOUT */}

            <button
              type="button"
              className="icon-button"
              onClick={
                handleLogoutClick
              }
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >

              <LogOut size={18} />

            </button>

          </div>

        </header>


        {/* ================================================================
            CONTENU
        ================================================================= */}

        <div className="content">

          <Routes>

            <Route
              path="/"
              element={
                <Dashboard />
              }
            />

            <Route
              path="/proxmox"
              element={
                <Proxmox />
              }
            />

            <Route
              path="/docker"
              element={
                <Docker />
              }
            />

            <Route
              path="/ovs"
              element={
                <OVS />
              }
            />

            <Route
              path="/wireguard"
              element={
                <WireGuard />
              }
            />

            <Route
              path="/prometheus"
              element={
                <Prometheus />
              }
            />

            <Route
              path="/alerts"
              element={
                <Alerts />
              }
            />

            <Route
              path="/users"
              element={
                <Users />
              }
            />


            {/*

              Un administrateur ne doit pas
              accéder à l'interface standard.

            */}

            <Route
              path="/user-dashboard"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />


            {/* ROUTE INCONNUE */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>

        </div>

      </main>

    </div>
  );
}


/*
|--------------------------------------------------------------------------
| APPLICATION
|--------------------------------------------------------------------------
*/

function App() {

  const [user, setUser] =
    useState(null);

  const [authLoading, setAuthLoading] =
    useState(true);


  /*
  |--------------------------------------------------------------------------
  | VÉRIFICATION SESSION
  |--------------------------------------------------------------------------
  */

  useEffect(() => {

    let mounted = true;


    const checkAuthentication =
      async () => {

        try {

          const response =
            await apiFetch(
              "/auth/me/"
            );


          if (!mounted) {
            return;
          }


          /*
           * apiFetch retourne une Response.
           */

          if (
            !response ||
            !response.ok
          ) {

            setUser(null);

            return;

          }


          const data =
            await response.json();


          if (
            data?.success &&
            data?.user
          ) {

            setUser(
              data.user
            );

          } else {

            setUser(null);

          }

        } catch (error) {

          console.error(
            "Erreur lors de la vérification de session :",
            error
          );


          if (mounted) {
            setUser(null);
          }

        } finally {

          if (mounted) {
            setAuthLoading(false);
          }

        }

      };


    checkAuthentication();


    return () => {

      mounted = false;

    };

  }, []);


  /*
  |--------------------------------------------------------------------------
  | CONNEXION
  |--------------------------------------------------------------------------
  */

  const handleLogin = (
    authenticatedUser
  ) => {

    console.log(
      "Utilisateur connecté :",
      authenticatedUser
    );


    setUser(
      authenticatedUser
    );

  };


  /*
  |--------------------------------------------------------------------------
  | DÉCONNEXION
  |--------------------------------------------------------------------------
  */

  const handleLogout = async () => {

    /*
     * On tente d'abord de fermer la session
     * côté Django.
     */

    try {

      const response =
        await apiFetch(
          "/auth/logout/",
          {
            method: "POST",
          }
        );


      if (
        response &&
        !response.ok
      ) {

        console.warn(
          "Le serveur a retourné une erreur lors de la déconnexion :",
          response.status
        );

      }

    } catch (error) {

      console.error(
        "Erreur API lors de la déconnexion :",
        error
      );

    } finally {

      /*
       * IMPORTANT :
       * on supprime toujours l'utilisateur
       * côté React.
       *
       * Cela force immédiatement
       * l'affichage de Login.
       */

      setUser(null);

      /*
       * On remet également le navigateur
       * à la racine.
       */

      window.history.replaceState(
        {},
        "",
        "/"
      );

    }

  };


  /*
  |--------------------------------------------------------------------------
  | CHARGEMENT
  |--------------------------------------------------------------------------
  */

  if (authLoading) {

    return (
      <div className="auth-loading">

        <div className="auth-loading-card">

          <div className="auth-loading-logo">
            H
          </div>

          <h2>
            HorizonOps
          </h2>

          <p>
            Vérification de la session...
          </p>

        </div>

      </div>
    );

  }


  /*
  |--------------------------------------------------------------------------
  | NON AUTHENTIFIÉ
  |--------------------------------------------------------------------------
  */

  if (!user) {

    return (
      <Login
        onLogin={
          handleLogin
        }
      />
    );

  }


  /*
  |--------------------------------------------------------------------------
  | AUTHENTIFIÉ
  |--------------------------------------------------------------------------
  */

  return (
    <BrowserRouter>

      <ProtectedRoutes
        user={user}
        onLogout={
          handleLogout
        }
      />

    </BrowserRouter>
  );
}


export default App;