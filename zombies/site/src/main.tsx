import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "./index.css";

const viewport = window.visualViewport;
if (viewport) {
  const fit = () => document.documentElement.style.setProperty("--app-h", `${viewport.height}px`);
  viewport.addEventListener("resize", fit);
  fit();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
