#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

fn main() {
    // Remplace `kashirlauncher` par le nom *exact* de ta crate (package name, hyphens -> underscores)
    kashirlauncher_lib::run();
}