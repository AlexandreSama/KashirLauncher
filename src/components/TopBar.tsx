import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();

export default function TopBar() {

    return (
        <div
            className="topbar2"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
            <div className="tb2-left" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                <div className="pill dev">DEV</div>
                <div className="sep" />
                <span className="tb2-brand">KASHIR LAUNCHER</span>
            </div>

            <div className="tb2-actions" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                <button className="tb2-btn" title="Réduire" onClick={() => win.minimize()}>–</button>
                <button className="tb2-btn close" title="Fermer" onClick={() => win.close()}>✕</button>
            </div>
        </div>
    );
}