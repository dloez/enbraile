import { useState } from "react";
import { BallSplit, ballTitleClass } from "@/components/ball-split";
import { authClient } from "@/lib/auth-client";
import { messages } from "../../shared/i18n";

const t = messages({
  en: { signIn: "Sign in with Discord", failed: "Sign-in failed" },
  es: { signIn: "Iniciar sesión con Discord", failed: "No se pudo iniciar sesión" },
});

function DiscordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-6 flex-none sm:size-6.5"
    >
      <path d="M8 4c-2 .4-3.5 1-5 2-1.5 3-2 6-2 9.5C2.5 17 4.5 18 7 18.6l1.2-2" />
      <path d="M16 4c2 .4 3.5 1 5 2 1.5 3 2 6 2 9.5-1.5 1.5-3.5 2.5-6 3.1l-1.2-2" />
      <path d="M6.5 16c3.5 1.6 7.5 1.6 11 0" />
      <circle cx="9" cy="11.5" r="1.4" />
      <circle cx="15" cy="11.5" r="1.4" />
    </svg>
  );
}

export function SignInPage() {
  const [failed, setFailed] = useState(() => new URLSearchParams(window.location.search).has("error"));
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setFailed(false);
    const back = window.location.pathname;
    const result = await authClient.signIn.social({ provider: "discord", callbackURL: back, errorCallbackURL: back });
    if (result.error) {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <BallSplit title={<h1 className={ballTitleClass}>pkmn</h1>} className="px-7 pb-10 sm:pb-14">
      <div className="flex w-full flex-col items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={signIn}
          className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-3 border-discord-edge bg-discord font-heading text-2xl text-white outline-none hover:bg-discord-hi focus-visible:bg-discord-hi focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 sm:min-h-16 sm:w-110 sm:gap-3.5 sm:text-3xl"
        >
          <DiscordIcon />
          {t.signIn}
        </button>
        {failed && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {t.failed}
          </p>
        )}
      </div>
    </BallSplit>
  );
}
