#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod minecraft;
mod security;

use tauri::{AppHandle, Manager};
use tauri::Emitter;
use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use std::convert::TryFrom; // <- important
pub const TRAY_ICON: tauri::image::Image<'static> =
    tauri::include_image!("icons/icon.png");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("no local data dir")
                .join("stronghold_salt.bin");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build()
            )?;
            build_tray(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // --- minecraft root ---
            minecraft::mc_fetch_versions,
            minecraft::mc_prepare_vanilla,
            // --- auth submodule ---
            minecraft::auth::mc_ms_start_device_code,
            minecraft::auth::mc_ms_poll_and_store,
            minecraft::auth::mc_fetch_profile_from_refresh,
            minecraft::auth::auth_is_connected,
            minecraft::auth::auth_logout,
            // --- launch submodule ---
            minecraft::launch::mc_launch_server,
            // --- security module ---
            security::ks_get_device_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let check_item = MenuItemBuilder::with_id("check-update", "Rechercher une mise à jour").build(app)?;
    let quit_item  = MenuItemBuilder::with_id("quit", "Fermer l'application").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&check_item, &quit_item]).build()?;

    TrayIconBuilder::new()
        .menu(&menu)
        .icon(TRAY_ICON)
        .show_menu_on_left_click(false)
        .tooltip("Kashir Launcher")
        .on_menu_event(|tray, event| {
            match event.id.as_ref() {
                "check-update" => { let _ = tray.app_handle().emit("tray://check-update", ()); }
                "quit" => { tray.app_handle().exit(0); }
                _ => {}
            }
        })
        .build(app)?;
    Ok(())
}
