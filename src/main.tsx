import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PreferencesProvider } from "./lib/preferences";
import { lockMediaDevices } from "./lib/media/browser";
import "./index.css";

// Kunci API capture kamera/mikrofon/layar global sebelum kode lain berjalan: kamera
// dan mikrofon hanya bisa diminta lewat lib/media/session.ts (lihat browser.ts).
lockMediaDevices();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
