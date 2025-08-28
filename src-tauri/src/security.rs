use tauri::{Manager};
use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub fn ks_get_device_secret(app: tauri::AppHandle) -> Result<String, String> {
    // 1) Trousseau natif (Windows Credential Manager / libsecret, etc.)
    let service = "fr.djinn.kashirlauncher";
    let user = "stronghold_device_secret";
    let entry = keyring::Entry::new(service, user).map_err(|e| e.to_string())?;

    if let Ok(secret) = entry.get_password() {
        return Ok(secret);
    }

    // 2) Génère une clé 32 bytes (CSPRNG)
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).map_err(|e| e.to_string())?;
    let secret = general_purpose::STANDARD_NO_PAD.encode(buf);

    // 3) Sauvegarde dans le trousseau, sinon fallback fichier local
    if let Err(_e) = entry.set_password(&secret) {
        let path = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("device_secret.b64");
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(&path, &secret).map_err(|e| e.to_string())?;
    }

    Ok(secret)
}
