import { type FormEvent, useState } from "react";
import { buttonClass, fieldClass, Panel } from "@/components/controls";
import { listPage, messageWidth } from "@/components/page";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function AdminPage() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <main className={listPage} />;
  if (data?.user.admin) return <AdminHome />;
  return <AdminSignIn />;
}

function AdminHome() {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <main className={cn(listPage, "gap-7 py-7 sm:py-9")}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 flex-1 font-heading text-5xl leading-none sm:text-6xl">Admin</h1>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await authClient.signOut();
            setSigningOut(false);
          }}
          className={buttonClass}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}

function AdminSignIn() {
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
      setError(result.error.status === 401 ? "Wrong username or password" : (result.error.message ?? "Sign-in failed"));
      setPassword("");
    }
  }

  return (
    <main className={cn(listPage, "py-7 sm:py-9")}>
      <Panel title="Admin sign-in" className={messageWidth}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Username
            <input
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={cn(fieldClass, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={cn(fieldClass, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
            />
          </label>
          {error && (
            <p role="alert" className="m-0 text-sm text-destructive">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={cn(buttonClass, "self-start")}>
            Sign in
          </button>
        </form>
      </Panel>
    </main>
  );
}
