import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTvSupport } from "./lib/tv";
import "./index.css";

initTvSupport();

createRoot(document.getElementById("root")!).render(<App />);
