"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="card stack" style={{ maxWidth: 360, margin: "10vh auto 0" }}>
      <h1>Caja Equinoccio</h1>
      <label className="f" htmlFor="email">
        Correo
        <input id="email" name="email" type="email" autoComplete="username" required />
      </label>
      <label className="f" htmlFor="password">
        Contraseña
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <div className="banner bad">{state.error}</div> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
