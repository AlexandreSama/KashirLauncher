import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import AppShell from "./components/AppShell";

const root = createRoot(document.getElementById("root")!);
root.render(
    <HashRouter>
        <AppShell>
            <App />
        </AppShell>
    </HashRouter>
);
