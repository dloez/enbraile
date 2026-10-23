import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 4h4v16h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </svg>
  );
}

export function useSignOut(): { signingOut: boolean; signOut: () => Promise<void> } {
  const [signingOut, setSigningOut] = useState(false);
  return {
    signingOut,
    signOut: async () => {
      setSigningOut(true);
      await authClient.signOut();
      setSigningOut(false);
    },
  };
}
