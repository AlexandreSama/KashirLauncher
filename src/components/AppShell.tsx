import React, { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

// Si tu configures l'updater plus tard, décommente :
// import { check } from "@tauri-apps/plugin-updater";

export default function AppShell({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const sub = listen("tray://check-update", async () => {
            try {
                // Si l’updater n’est pas encore configuré, tu peux juste notifier :
                alert("Vérification des mises à jour (à configurer)…");

                // Exemple quand tu auras configuré l'updater :
                // const update = await check();
                // if (update?.available) {
                //   await update.downloadAndInstall();
                // } else {
                //   alert("Aucune mise à jour disponible.");
                // }
            } catch (e) {
                console.error(e);
                alert("Erreur lors de la vérification des mises à jour.");
            }
        });

        return () => { sub.then(u => u()); };
    }, []);

    return <>{children}</>;
}
