import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { attachNotifyToWindow } from "./lib/notify";
import "./i18n"; // Initialise i18next

attachNotifyToWindow();

createRoot(document.getElementById("root")!).render(<App />);
