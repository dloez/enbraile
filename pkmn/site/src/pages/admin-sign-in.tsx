import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { BallSplit, ballTitleClass } from "@/components/ball-split";
import { formFieldClass, formLabelClass } from "@/components/controls";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";

const t = messages({
  en: {
    wrong: "Wrong username or password",
    failed: "Sign-in failed",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    notAdmin: "Not an admin? Players sign in with Discord",
  },
  es: {
    wrong: "Usuario o contraseña incorrectos",
    failed: "No se ha podido iniciar sesión",
    username: "Usuario",
    password: "Contraseña",
    signIn: "Iniciar sesión",
    notAdmin: "¿No eres admin? Los jugadores inician sesión con Discord",
  },
});

export function AdminSignInPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.username({ username, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.status === 401 ? t.wrong : (result.error.message ?? t.failed));
      setPassword("");
    }
  }

  return (
    <BallSplit admin title={<h1 className={ballTitleClass}>pkmn</h1>} className="px-4 pb-10 sm:pb-14">
      <form onSubmit={submit} className="flex w-full flex-col gap-4.5 rounded-2xl border-3 bg-card px-6 pt-6 pb-7 sm:w-110 sm:px-7 sm:pt-7">
        <label className={cn(formLabelClass, "text-2xl text-subtle")}>
          {t.username}
          <input
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={cn(formFieldClass, "h-12.5 text-lg")}
          />
        </label>
        <label className={cn(formLabelClass, "text-2xl text-subtle")}>
          {t.password}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={error !== null}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={cn(formFieldClass, "h-12.5 text-lg")}
          />
        </label>
        {error && (
          <p role="alert" className="-mt-1 mb-0 text-[0.9375rem] font-bold text-destructive">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={buttonVariants({ variant: "go", className: "mt-1 min-h-14 text-[1.875rem]" })}>
          {t.signIn}
        </button>
      </form>
      <Link
        to="/"
        className="mt-5.5 text-[0.9375rem] font-bold text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t.notAdmin}
      </Link>
    </BallSplit>
  );
}
