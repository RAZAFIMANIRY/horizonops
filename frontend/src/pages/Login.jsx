import { useState } from "react";
import { LockKeyhole, User, LogIn } from "lucide-react";
import { apiFetch } from "../api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/auth/login/", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message || "Nom d'utilisateur ou mot de passe incorrect."
        );
        return;
      }

      onLogin(data.user);
    } catch (err) {
      setError(
        "Impossible de contacter le serveur HorizonOps."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-header">
          <div className="login-logo">
            H
          </div>

          <h1>HorizonOps</h1>
          <p>Infrastructure Control</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">

          <div className="form-group">
            <label htmlFor="username">
              Nom d'utilisateur
            </label>

            <div className="input-wrapper">
              <User size={18} />

              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Votre nom d'utilisateur"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Mot de passe
            </label>

            <div className="input-wrapper">
              <LockKeyhole size={18} />

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            <LogIn size={18} />

            {loading
              ? "Connexion..."
              : "Se connecter"}
          </button>

        </form>

        <div className="login-footer">
          HorizonOps v1.0.0
        </div>

      </div>
    </div>
  );
}

export default Login;