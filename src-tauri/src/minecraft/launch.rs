use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
pub struct LaunchArgs {
    pub server_id: String,
    pub ram_mb: u32,
}

#[derive(Debug, Serialize, Clone)]
struct ProgressPayload {
    step: String,
    percent: u8,
    detail: Option<String>,
}

fn emit_progress(app: &AppHandle, step: &str, percent: u8, detail: Option<&str>) {
    let payload = ProgressPayload {
        step: step.to_string(),
        percent,
        detail: detail.map(|s| s.to_string()),
    };
    let _ = app.emit("mc://progress", payload);
}
fn emit_log(app: &AppHandle, line: &str) {
    let _ = app.emit("mc://log", serde_json::json!({ "line": line }));
}
fn emit_done(app: &AppHandle, ok: bool, error: Option<&str>) {
    let _ = app.emit("mc://done", serde_json::json!({ "ok": ok, "error": error }));
}

#[tauri::command]
pub async fn mc_launch_server(app: tauri::AppHandle, args: LaunchArgs) -> Result<(), String> {
    // Simule les étapes (remplace par ton vrai pipeline)
    let server = args.server_id;
    let ram = args.ram_mb;

    tauri::async_runtime::spawn({
        let app = app.clone();
        async move {
            emit_log(&app, &format!("Préparation du lancement… serveur={server}, RAM={} Mo", ram));

            // Étape 1: vérification
            emit_progress(&app, "vérification", 5, Some("lecture config"));
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;

            // Étape 2: résolution (manifests, librairies)
            emit_progress(&app, "résolution", 15, Some("manifestes"));
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;

            // Étape 3: téléchargement (boucle)
            for p in [20,30,45,60,75,85].iter() {
                emit_progress(&app, "téléchargement", *p as u8, Some("libs/assets"));
                tokio::time::sleep(std::time::Duration::from_millis(350)).await;
            }

            // Étape 4: vérification des fichiers
            emit_progress(&app, "vérification", 90, Some("intégrité"));
            tokio::time::sleep(std::time::Duration::from_millis(350)).await;

            // Étape 5: lancement
            emit_log(&app, "Démarrage de la JVM…");
            emit_progress(&app, "lancement", 98, Some("java args"));
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;

            // Fin
            emit_progress(&app, "prêt", 100, None);
            emit_done(&app, true, None);
        }
    });

    Ok(())
}
