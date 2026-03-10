import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Home from "./pages/Home.jsx";

async function loadAmplifyOutputs() {
  const modules = import.meta.glob("../amplify/outputs/amplify_outputs.json", {
    eager: true,
    import: "default"
  });

  const key = Object.keys(modules)[0];
  if (!key) {
    return {};
  }

  const outputs = modules[key];
  return outputs || {};
}

async function bootstrap() {
  const amplifyOutputs = await loadAmplifyOutputs().catch(() => ({}));

  const hasAmplifyConfig =
    amplifyOutputs &&
    amplifyOutputs.amplifyConfig &&
    Object.keys(amplifyOutputs.amplifyConfig).length > 0;

  if (hasAmplifyConfig) {
    // Optional: dynamic import to avoid hard dependency when not used.
    // Usamos @vite-ignore y un nombre dinámico para no requerir que aws-amplify esté instalado.
    try {
      const moduleName = "aws-amplify";
      // eslint-disable-next-line import/no-dynamic-require
      const { Amplify } = await import(/* @vite-ignore */ moduleName);
      Amplify.configure(amplifyOutputs.amplifyConfig);
    } catch {
      // aws-amplify no instalado o no necesario aún; ignorar
    }
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <Home amplifyOutputs={amplifyOutputs} />
    </React.StrictMode>
  );
}

bootstrap();
