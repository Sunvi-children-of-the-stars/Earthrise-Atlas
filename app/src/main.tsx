import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./site/App";
import "./site/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
