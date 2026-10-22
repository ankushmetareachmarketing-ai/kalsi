"use client";
import { useEffect, useState, type FormEvent } from "react";
import Dashboard from "./dashboard";

// Dummy login for now — credentials are hardcoded, not secure.
const USER = "admin",
  PASS = "admin123",
  KEY = "kalsi-auth";

export default function LoginGate() {
  const [ok, setOk] = useState<boolean | null>(null),
    [user, setUser] = useState(""),
    [pass, setPass] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      setOk(localStorage.getItem(KEY) === "1");
    } catch {
      setOk(false);
    }
  }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (user.trim() === USER && pass === PASS) {
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
      setOk(true);
    } else setError("Invalid username or password");
  }
  if (ok === null) return null;
  if (ok)
    return (
      <>
        <Dashboard />
        <button
          className="button button-light"
          style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50 }}
          onClick={() => {
            try {
              localStorage.removeItem(KEY);
            } catch {}
            setOk(false);
          }}
        >
          Logout
        </button>
      </>
    );
  const input = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 14,
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
        padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 28,
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, color: "var(--deep)", margin: 0 }}>
            Kalsi Payroll
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
            Sign in to continue
          </p>
        </div>
        <input
          style={input}
          placeholder="Username"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
        />
        <input
          style={input}
          type="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}
        <button className="button button-primary" type="submit">
          Login
        </button>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Demo: admin / admin123
        </p>
      </form>
    </div>
  );
}
