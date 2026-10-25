import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { prefetch } from "@/lib/api";
import { router } from "@/router";
import "./index.css";

function forget(step: () => void) {
  try {
    step();
  } catch {
    return;
  }
}

forget(() => indexedDB.deleteDatabase("open-sheet"));
forget(() => localStorage.removeItem("team-analysis:drafts"));

prefetch("/auth/get-session");
prefetch("/series");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
