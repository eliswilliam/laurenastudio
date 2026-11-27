import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { attachNotifyToWindow } from "./lib/notify";
import "./i18n"; // Initialise i18next

if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.getRegistrations()
		.then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
		.catch(() => undefined);
}

attachNotifyToWindow();

createRoot(document.getElementById("root")!).render(<App />);
