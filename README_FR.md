# Kashir Launcher

**Desktop launcher Minecraft + Gestionnaire de VM Proxmox**  
Windows & Linux • Tauri (Rust) + React

> Authentifie les joueurs via Microsoft (Device Code), vérifie la licence Minecraft, lance le jeu (vanilla/modpacks), et pilote des VMs Proxmox via API (création/démarrage/arrêt/console, etc.).  
> Aucune prise en charge du mode hors-ligne/piraté.

---

## ✨ Fonctionnalités

### Minecraft
- **Connexion Microsoft (OAuth 2.0 Device Code)**  
  Endpoints *consumers* + scopes minimaux : `XboxLive.signin` et `offline_access`.
- **Chaîne d’auth complétée côté Rust** (tokens courts jamais exposés au front) :  
  MS Access Token → **Xbox Live `user.authenticate`** → **XSTS** → **Minecraft Services `authentication/login_with_xbox`** → **vérification des entitlements** → **profil joueur** (UUID / name / skin).
- **Sélection de serveur** (au lieu de version/modloader), avec **téléchargement & progression** (barres + logs) puis **lancement**.
- **UI Tauri custom** (fenêtre sans décorations, TopBar personnalisée, Tray : “Rechercher une mise à jour” / “Fermer l’application”).
- **Déconnexion** (purge sécurisée du refresh token).

### Gestionnaire de VM (Proxmox)
- **Connexion à l’API Proxmox** (token recommandé) ; aucune exigence d’agent côté VM si tu ne le souhaites pas.
- **Lister / créer / modifier / supprimer** des VMs, **démarrer/arrêter/redémarrer**, **console** (VNC/SPICE via URL ouverte par le shell système).
- **Bonnes pratiques** : utiliser un **API Token** dédié (périmètre limité par rôle/ACL), pas de stockage de mot de passe brut.

---

## 🔐 Sécurité & confidentialité

- **Scopes minimaux** : `XboxLive.signin`, `offline_access`.  
  Pas d’autres API Microsoft (pas de contacts, OneDrive, etc.).
- **Flux device code** via **navigateur système** (pas de webview embarquée).
- **Stockage des secrets** : uniquement le **refresh token** (MSA) en **coffre natif de l’OS**  
  - Windows : *Windows Credential Manager* (via `keyring`/impl wincred).  
  - Linux : *libsecret/Secret Service*.  
  - **Aucun token court n’est renvoyé au front**.
- **Pas de télémétrie**.  
- **Conformité Mojang/Microsoft** : aucune fonctionnalité d’offline/piratage. Un compte Minecraft valide est requis.

---

## 🛠️ Stack & Architecture

- **Frontend** : React + Vite (HashRouter), CSS maison (Inter), composants “Hero cards”, TopBar custom.
- **Backend** : Rust (Tauri)  
  - Modules : `minecraft::auth`, `minecraft::launch`, `minecraft` (versions…), `security`.  
  - Événements vers le front : `mc://progress`, `mc://log`, `mc://done` (progression lancement).
  - Tray Tauri (menu contextuel).
- **Interop** :  
  - **Microsoft** : `login.microsoftonline.com/consumers` (device code + token).  
  - **Xbox Live** : `user.auth.xboxlive.com` (RPS) → `xsts.auth.xboxlive.com` (XSTS).  
  - **Minecraft Services** : `api.minecraftservices.com` (`login_with_xbox`, entitlements, profil).  
  - **Proxmox** : endpoint API configuré (voir *Configuration*).

---

## ⚙️ Configuration

Crée un fichier `.env` (ou variables d’environnement) :

```dotenv
# Microsoft Azure App Registration (public client)
KASHIR_MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Proxmox (optionnel si tu n’utilises pas la partie VM tout de suite)
PROXMOX_BASE_URL=https://proxmox.example.local:8006/api2/json
PROXMOX_TOKEN_ID=user@pve!kashir-launcher
PROXMOX_TOKEN_SECRET=xxxxx-xxxxx-xxxxx
```

> **Important (Minecraft Services)** : ton **App (client) ID** doit être **approuvé** par l’équipe Minecraft pour pouvoir appeler `authentication/login_with_xbox`. Sans approbation, tu auras :  
> `403 Forbidden – Invalid app registration` (cf. formulaire “New AppId for Approval”).

---

## ▶️ Développement

### Prérequis
- **Rust** (stable) + **Node.js** LTS
- **Tauri CLI** (`cargo install tauri-cli`)
- Windows : MSVC build tools ; Linux : paquets `webkit2gtk`, `libappindicator`, etc. (cf. docs Tauri selon distro).

### Lancer en dev

```bash
# à la racine du projet (front + src-tauri/)
npm install
npm run tauri dev
```

- Dev URL : `http://localhost:1420`
- Logs Rust dans le terminal (et optionnellement via `tauri-plugin-log` dans la console web).

### Build / Package

```bash
# binaire + bundle (Windows + Linux)
npm run tauri build
```

- **Windows** : `.msi` (par défaut) ; NSIS et autres possibles via config Tauri.  
- **Linux** : `.AppImage`, `.deb`, `.rpm` selon la config.

---

## 🖼️ Captures (placeholder)

- Accueil avec deux “services” (Minecraft / Proxmox) — *hero cards*  
- Écran de connexion Microsoft (device code : étape 1/2 puis 2/2)  
- Page Minecraft (sélection serveur + progression de téléchargement/lancement)  
- Vue Proxmox (liste des VMs + actions rapides)

*(Ajoute tes images dans `docs/` et lie-les ici.)*

---

## 🧭 Roadmap

- [ ] Mise à jour auto (Win/Linux)  
- [ ] Téléchargement assets/libs Minecraft + JRE géré automatiquement  
- [ ] Profils serveurs (modpacks), validation d’intégrité, cache  
- [ ] Console intégrée pour logs de lancement  
- [ ] UI Proxmox : création depuis templates, snapshots, métriques  
- [ ] Installateur custom (plus tard)

---

## 📝 Pour la review Microsoft (récap)

- **Flow** : Device Code → XBL `user.authenticate` → XSTS → `login_with_xbox` → entitlements → profil.  
- **Scopes** : `XboxLive.signin`, `offline_access` (minimaux).  
- **Sécurité** : navigateur système, tokens courts non exposés au front, refresh token en coffre natif OS.  
- **Conformité** : pas d’offline/piratage, respect ToS/EULA ; usage strictement nécessaire au lancement du jeu.

---

## ⚖️ Mentions légales

- **Non affilié** à Mojang Studios / Microsoft / Proxmox.  
- *Minecraft* et toutes marques associées sont la propriété de leurs détenteurs respectifs.  
- L’utilisation nécessite une **licence Minecraft** valide.  
- Pour Proxmox, respecte les licences et ACLs de ton infrastructure.

---

## 📬 Contact

- Email : `contact@exemple.com`  
- Repo : `https://github.com/ton-org/kashir-launcher` *(à adapter)*
