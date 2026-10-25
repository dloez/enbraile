import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";
import "./index.css";

function forgetOpenSheet() {
  try {
    indexedDB.deleteDatabase("open-sheet");
  } catch {
    return;
  }
}

forgetOpenSheet();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
