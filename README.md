# Kashir Launcher

**Desktop Minecraft Launcher + Proxmox VM Manager**  
Windows & Linux • Tauri (Rust) + React

> Authenticates players with Microsoft (OAuth 2.0 Device Code), verifies Minecraft ownership, launches vanilla or curated modded profiles, and controls Proxmox VMs via API (create/start/stop/console, etc.).  
> No offline/piracy features.

---

## ✨ Features

### Minecraft
- **Microsoft Sign‑In (OAuth 2.0 Device Code)**  
  Using the *consumers* endpoints with minimal scopes: `XboxLive.signin` and `offline_access`.
- **Auth chain fully handled in Rust** (short‑lived tokens never exposed to the frontend):  
  MS Access Token → **Xbox Live `user.authenticate`** → **XSTS** → **Minecraft Services `authentication/login_with_xbox`** → **entitlements check** → **player profile** (UUID / name / skin).
- **Server‑centric UX** (pick the server you want to join), with **download & launch progress** (bars + logs) and final game start.
- **Custom Tauri window** (frameless, custom TopBar, Tray menu: “Check for updates” / “Quit app”).
- **Logout** (secure refresh‑token purge).

### Proxmox VM Manager
- **Connect to Proxmox API** (API token recommended); no in‑guest agent required unless you want deeper control.
- **List / create / edit / delete** VMs, **start/stop/reboot**, **console** (VNC/SPICE via system browser/shell).
- **Best practices**: use a dedicated **API Token** with least‑privilege role/ACL; no plaintext password storage.

---

## 🔐 Security & Privacy

- **Minimal scopes**: `XboxLive.signin`, `offline_access`. No other Microsoft APIs are used.
- **Device Code flow** uses the **system browser** (no embedded webview).
- **Secret storage**: only the **Microsoft refresh token** is persisted, in the OS **native credential store**  
  - Windows: *Windows Credential Manager* (wincred via `keyring`).  
  - Linux: *libsecret / Secret Service*.
- **Short‑lived tokens are never returned to the frontend**.
- **No telemetry.**  
- **Compliance**: respects Mojang/Microsoft terms; **no offline/pirated gameplay**.

---

## 🛠️ Stack & Architecture

- **Frontend**: React + Vite (HashRouter), custom CSS (Inter), “hero cards”, custom TopBar.
- **Backend**: Rust (Tauri)  
  - Modules: `minecraft::auth`, `minecraft::launch`, `minecraft` (versions, etc.), `security`.  
  - Events to the UI: `mc://progress`, `mc://log`, `mc://done` (launch progress).
  - Tauri Tray integration (context menu).
- **Interop**:  
  - **Microsoft**: `login.microsoftonline.com/consumers` (device code + token).  
  - **Xbox Live**: `user.auth.xboxlive.com` (RPS) → `xsts.auth.xboxlive.com` (XSTS).  
  - **Minecraft Services**: `api.minecraftservices.com` (`login_with_xbox`, entitlements, profile).  
  - **Proxmox**: configurable API base URL (see *Configuration*).

---

## ⚙️ Configuration

Create a `.env` file (or environment variables):

```dotenv
# Microsoft Azure App Registration (public client)
KASHIR_MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Proxmox (optional if you don’t use the VM side yet)
PROXMOX_BASE_URL=https://proxmox.example.local:8006/api2/json
PROXMOX_TOKEN_ID=user@pve!kashir-launcher
PROXMOX_TOKEN_SECRET=xxxxx-xxxxx-xxxxx
```

> **Important (Minecraft Services)**: your **Azure App (client) ID** must be **approved** by the Minecraft team to call `authentication/login_with_xbox`. Without approval you will receive:  
> `403 Forbidden – Invalid app registration` (see Microsoft/Minecraft review form; choose “New AppId for Approval”).

---

## ▶️ Development

### Prerequisites
- **Rust** (stable) + **Node.js** LTS
- **Tauri CLI** (`cargo install tauri-cli`)
- Windows: MSVC build tools; Linux: `webkit2gtk`, `libappindicator`, etc. (see Tauri docs for your distro).

### Run in dev

```bash
# at project root (frontend + src-tauri/)
npm install
npm run tauri dev
```

- Dev URL: `http://localhost:1420`
- Rust logs in your terminal (and optionally via `tauri-plugin-log` to the web console).

### Build / Package

```bash
# binary + installer/bundles (Windows + Linux)
npm run tauri build
```

- **Windows**: `.msi` by default; NSIS and other options are possible in Tauri config.  
- **Linux**: `.AppImage`, `.deb`, `.rpm` depending on configuration.

---

## 🖼️ Screenshots (placeholders)

- Home with two “services” (Minecraft / Proxmox) — *hero cards*  
- Microsoft sign‑in (device code: step 1/2 then 2/2)  
- Minecraft page (server selection + download/launch progress)  
- Proxmox view (VM list + quick actions)

*(Add your images under `docs/` and reference them here.)*

---

## 🧭 Roadmap

- [ ] Auto‑update (Win/Linux)  
- [ ] Minecraft assets/libs download + managed JRE  
- [ ] Server profiles (modpacks), integrity validation, caching  
- [ ] Embedded console for launch logs  
- [ ] Proxmox UI: create from templates, snapshots, metrics  
- [ ] Custom installer (later)

---

## 📝 For Microsoft/Minecraft review (recap)

- **Flow**: Device Code → XBL `user.authenticate` → XSTS → `login_with_xbox` → entitlements → profile.  
- **Scopes**: `XboxLive.signin`, `offline_access` (minimal).  
- **Security**: system browser, short‑lived tokens not exposed to UI, refresh token in OS keyring.  
- **Compliance**: no offline/pirated gameplay; ToS/EULA respected; access strictly required for legitimate sign‑in and launch.

---

## ⚖️ Legal

- **Not affiliated** with Mojang Studios / Microsoft / Proxmox.  
- *Minecraft* and related trademarks are the property of their respective owners.  
- Requires a **valid Minecraft license**.  
- For Proxmox, follow your infrastructure’s licensing and ACL policies.

---

## 📬 Contact

- Email: `contact@example.com`  
- Repo: `https://github.com/your-org/kashir-launcher` *(update as needed)*
