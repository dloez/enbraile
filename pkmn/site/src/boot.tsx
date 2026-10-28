import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";
import "./index.css";

function forget(step: () => void) {
  try {
    step();
  } catch {
    return;
  }
}

const RELOADED_AT = "chunk-reload-at";

function reloadForNewDeploy() {
  let last = 0;
  forget(() => {
    last = Number(sessionStorage.getItem(RELOADED_AT));
  });
  if (Date.now() - last < 10_000) return;
  forget(() => sessionStorage.setItem(RELOADED_AT, String(Date.now())));
  window.location.reload();
}

window.addEventListener("vite:preloadError", reloadForNewDeploy);

forget(() => indexedDB.deleteDatabase("open-sheet"));
forget(() => localStorage.removeItem("team-analysis:drafts"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
