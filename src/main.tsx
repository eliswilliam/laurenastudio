import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { attachNotifyToWindow } from "./lib/notify";

attachNotifyToWindow();

createRoot(document.getElementById("root")!).render(<App />);
