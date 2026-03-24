import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/shared/ErrorBoundary.jsx";
import OfflineDetector from "./components/shared/OfflineDetector.jsx";
import { registerSW } from 'virtual:pwa-register'
registerSW({ onNeedRefresh() { window.location.reload() } })

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <OfflineDetector />
      <App />
    </ErrorBoundary>
  </StrictMode>
);