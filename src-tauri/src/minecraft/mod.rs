pub mod auth;
pub mod launch;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use reqwest;

const VERSION_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

#[derive(Debug, Error)]
pub enum McError {
    #[error("http error: {0}")]
    Http(String),
    #[error("json error: {0}")]
    Json(String),
}

#[derive(Debug, Deserialize)]
struct ManifestRoot {
    versions: Vec<VersionEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VersionEntry {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    release_time: String,
}

#[derive(Debug, Serialize)]
pub struct McVersion {
    pub id: String,
    pub kind: String,
    pub release_time: String,
}

#[tauri::command]
pub fn mc_fetch_versions() -> Result<Vec<McVersion>, String> {
    let resp = reqwest::blocking::get(VERSION_MANIFEST_URL)
        .map_err(|e| McError::Http(e.to_string()).to_string())?;
    let root: ManifestRoot = resp
        .json()
        .map_err(|e| McError::Json(e.to_string()).to_string())?;

    let mut out: Vec<McVersion> = root
        .versions
        .into_iter()
        .map(|v| McVersion {
            id: v.id,
            kind: v.kind,
            release_time: v.release_time,
        })
        .collect();

    out.truncate(50);
    Ok(out)
}

#[tauri::command]
pub fn mc_prepare_vanilla(version_id: String, ram_mb: u32) -> Result<String, String> {
    let cmd = format!(
        "java -Xmx{ram}m -XX:+UseG1GC -jar ./minecraft/{vid}/client.jar --username Player --version {vid}",
        ram = ram_mb,
        vid = version_id
    );
    Ok(cmd)
}
