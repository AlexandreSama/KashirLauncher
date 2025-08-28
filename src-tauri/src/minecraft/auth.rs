use serde::{Deserialize, Serialize};
use std::time::Instant;
use base64::Engine;
use base64::engine::general_purpose;
use keyring::credential::CredentialApi;
use keyring::windows::WinCredential;
use serde_json::json;
use tauri::AppHandle;
/* ===================== Config Microsoft ===================== */
const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MARKET: &str = "fr-FR"; // message localisé

// 👉 Remplace par TON client_id (app publique, "Allow public client flows" = Enabled)
const MS_CLIENT_ID: &str = "e5a244a8-3f50-41fb-b4fb-5b58bf356f5e";
const MS_SCOPES: &str = "XboxLive.signin offline_access";

const SERVICE: &str = "ks";
const USER:    &str = "ksrefresh";
const TARGET:  &str = "ksmain"; // court et stable (= target_name côté WinCred)

/* ===================== Types ===================== */

fn jwt_claims_scopes(token: &str) -> Option<String> {
    // payload = 2e segment du JWT
    let seg = token.split('.').nth(1)?;
    let padded = match seg.len() % 4 { 2 => format!("{seg}=="), 3 => format!("{seg}="), _ => seg.to_string() };
    let json = general_purpose::URL_SAFE_NO_PAD.decode(padded).ok()?;
    #[derive(serde::Deserialize)] struct Claims { scp: Option<String> }
    serde_json::from_slice::<Claims>(&json).ok()?.scp
}

#[derive(Debug, Deserialize)]
struct XblError {
    #[serde(rename = "XErr")]
    xerr: Option<u64>,
    Message: Option<String>,
    Redirect: Option<String>,
}
#[derive(Debug, Deserialize, Serialize)]
pub struct DeviceCodeStart {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeRaw {
    user_code: String,
    device_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
    message: String,
}

// Déclaré mais pas renvoyé au front (on garde pour usage interne si besoin)
#[derive(Debug, Deserialize, Serialize)]
pub struct MsToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
}

#[derive(Debug, Deserialize)]
struct MsTokenRaw {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    token_type: String,
}

/* ===================== Start Device Code ===================== */
#[tauri::command]
pub fn mc_ms_start_device_code() -> Result<DeviceCodeStart, String> {
    let form = [("client_id", MS_CLIENT_ID), ("scope", MS_SCOPES)];
    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(MS_DEVICE_CODE_URL)
        .query(&[("mkt", MARKET)]) // message FR
        .form(&form)
        .send()
        .map_err(|e| format!("http error: {e}"))?;
    let status = resp.status();
    let body = resp.text().unwrap_or_default();

    if !status.is_success() {
        return Err(format!("ms device code failed: {status} – {body}"));
    }

    let raw: DeviceCodeRaw =
        serde_json::from_str(&body).map_err(|e| format!("json error: {e} – body: {body}"))?;

    Ok(DeviceCodeStart {
        user_code: raw.user_code,
        device_code: raw.device_code,
        verification_uri: raw.verification_uri,
        expires_in: raw.expires_in,
        interval: raw.interval.max(3),
        message: raw.message,
    })
}

/* ===================== Args (camelCase + snake_case) ===================== */
#[derive(Debug, Deserialize)]
pub struct DevicePollArgs {
    #[serde(alias = "deviceCode")]
    pub device_code: String,
    #[serde(alias = "intervalSecs")]
    pub interval_secs: u64,
    #[serde(alias = "timeoutSecs")]
    pub timeout_secs: u64,
}

/* ===================== Keyring helpers (refresh token only) ===================== */
#[cfg(windows)]
fn mask_len(s: &str) -> String {
    // n’affiche jamais le secret : montre longueur + un mini aperçu masqué
    let n = s.len();
    let head = s.chars().take(4).collect::<String>();
    let tail = s.chars().rev().take(4).collect::<String>().chars().rev().collect::<String>();
    format!("{}…{} (len={})", head, tail, n)
}

#[cfg(windows)]
fn save_refresh_token(_app: &tauri::AppHandle, refresh: &str) -> Result<(), String> {
    println!("[wincred] save_refresh_token: target={TARGET} service={SERVICE} user={USER} secret={}", mask_len(refresh));
    let cred = WinCredential::new_with_target(Some(TARGET), SERVICE, USER)
        .map_err(|e| {
            println!("[wincred] new_with_target ERR: {:?} / {}", e, e);
            e.to_string()
        })?;

    match cred.set_password(refresh) {
        Ok(()) => {
            println!("[wincred] set_password OK");
            // lecture immédiate pour vérifier la persistance
            match cred.get_password() {
                Ok(back) => {
                    println!("[wincred] post-write get_password OK: {}", mask_len(&back));
                }
                Err(e) => {
                    println!("[wincred] post-write get_password ERR: {:?} / {}", e, e);
                }
            }
            Ok(())
        }
        Err(e) => {
            println!("[wincred] set_password ERR: {:?} / {}", e, e);
            Err(e.to_string())
        }
    }
}

#[cfg(windows)]
fn get_refresh_token(_app: &tauri::AppHandle) -> Result<String, String> {
    println!("[wincred] get_refresh_token: target={TARGET} service={SERVICE} user={USER}");
    let cred = WinCredential::new_with_target(Some(TARGET), SERVICE, USER)
        .map_err(|e| {
            println!("[wincred] new_with_target ERR: {:?} / {}", e, e);
            e.to_string()
        })?;

    match cred.get_password() {
        Ok(s) => {
            println!("[wincred] get_password OK: {}", mask_len(&s));
            Ok(s)
        }
        Err(e) => {
            println!("[wincred] get_password ERR: {:?} / {}", e, e);
            Err(e.to_string())
        }
    }
}

#[cfg(windows)]
fn delete_refresh_token(_app: &tauri::AppHandle) -> Result<(), String> {
    println!("[wincred] delete_refresh_token: target={TARGET} service={SERVICE} user={USER}");
    let cred = WinCredential::new_with_target(Some(TARGET), SERVICE, USER)
        .map_err(|e| {
            println!("[wincred] new_with_target ERR: {:?} / {}", e, e);
            e.to_string()
        })?;

    match cred.delete_credential() {
        Ok(()) => {
            println!("[wincred] delete_credential OK");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => {
            println!("[wincred] delete_credential: NoEntry (déjà supprimé)");
            Ok(())
        }
        Err(e) => {
            println!("[wincred] delete_credential ERR: {:?} / {}", e, e);
            Err(e.to_string())
        }
    }
}
/* ===================== Poll + Store (async, pas de token vers le front) ===================== */
#[tauri::command]
pub async fn mc_ms_poll_and_store(app: AppHandle, args: DevicePollArgs) -> Result<(), String> {
    let DevicePollArgs {
        device_code,
        interval_secs,
        timeout_secs,
    } = args;

    let client = reqwest::Client::new();
    let start = Instant::now();

    loop {
        if start.elapsed().as_secs() > timeout_secs {
            return Err("timeout waiting for authorization".into());
        }

        let form = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", MS_CLIENT_ID),
            ("device_code", device_code.as_str()),
        ];

        let res = client
            .post(MS_TOKEN_URL)
            .form(&form)
            .send()
            .await
            .map_err(|e| format!("http error: {e}"))?;

        let status = res.status();
        let text = res.text().await.unwrap_or_default();

        if status.is_success() {
            let raw: MsTokenRaw =
                serde_json::from_str(&text).map_err(|e| format!("json error: {e} – body: {text}"))?;

            let Some(refresh) = raw.refresh_token else {
                return Err("no refresh_token returned (scope offline_access manquant ?)".into());
            };

            // 🔐 Stocke uniquement le refresh token (remember me)
            save_refresh_token(&app, &refresh)?;

            // Ici tu peux enchaîner XBL→XSTS→Minecraft côté Rust, en mémoire,
            // et ne jamais exposer les tokens courts au front.
            return Ok(());
        } else {
            if text.contains("authorization_pending") {
                // continue; on dormira ci-dessous
            } else if text.contains("slow_down") {
                tokio::time::sleep(std::time::Duration::from_secs(interval_secs + 2)).await;
            } else if text.contains("expired_token") {
                return Err("device code expired".into());
            } else {
                return Err(format!("token exchange failed: {status} – {text}"));
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
    }
}

/* ===================== Session utils ===================== */
#[tauri::command]
pub fn auth_is_connected(app: AppHandle) -> bool {
    get_refresh_token(&app).is_ok()
}

#[tauri::command]
pub fn auth_logout(app: AppHandle) -> Result<(), String> {
    delete_refresh_token(&app)
}

/* ===================== Chaîne Refresh → XBL → XSTS → MC Profile ===================== */

#[derive(Debug, Deserialize, Serialize)]
pub struct McProfileLite {
    pub id: String,
    pub name: String,
    pub skin_url: Option<String>,
}

/* -- 1) Refresh Microsoft access_token depuis le refresh_token stocké -- */
async fn ms_refresh_access_token(refresh: &str) -> Result<String, String> {
    println!("[auth] ms_refresh_access_token: start");
    let form = [
        ("grant_type", "refresh_token"),
        ("client_id", MS_CLIENT_ID),
        ("refresh_token", refresh),
        ("scope", MS_SCOPES), // <-- important
    ];
    let res = reqwest::Client::new()
        .post(MS_TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|e| { println!("[auth] ms_refresh_access_token http err: {e}"); format!("http error: {e}") })?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        println!("[auth] ms_refresh_access_token FAIL {status} – {text}");
        return Err(format!("ms refresh failed: {status} – {text}"));
    }
    let raw: MsTokenRaw = serde_json::from_str(&text)
        .map_err(|e| { println!("[auth] ms_refresh_access_token json err: {e} – body: {text}"); format!("json error: {e} – body: {text}") })?;

    if let Some(s) = jwt_claims_scopes(&raw.access_token) {
        println!("[auth] ms_access.scp = {s}");
    } else {
        println!("[auth] ms_access.scp = <absent>");
    }
    Ok(raw.access_token)
}
/* -- 2) XBL user.authenticate -- */
#[derive(Deserialize)]
struct XblAuthResp {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XuiClaims,
}
#[derive(Deserialize)]
struct XuiClaims { xui: Vec<Uhs> }
#[derive(Deserialize)]
struct Uhs { uhs: String }

async fn xbl_auth(ms_access_token: &str) -> Result<(String, String), String> {
    println!("[auth] xbl_auth: start");
    let body = serde_json::json!({
        "Properties": {
          "AuthMethod": "RPS",
          "SiteName": "user.auth.xboxlive.com",
          "RpsTicket": format!("d={}", ms_access_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });
    let client = reqwest::Client::new();
    let res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("x-xbl-contract-version", "1")
        .json(&body)
        .send()
        .await
        .map_err(|e| { println!("[auth] xbl_auth http err: {e}"); format!("http error: {e}") })?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<XblError>(&text) {
            let x = err.xerr.unwrap_or(0);
            let hint = match x {
                2148916233 => "→ Pas de profil Xbox: connecte-toi sur xbox.com et crée un gamertag.",
                2148916235 => "→ Compte enfant: validation parentale nécessaire.",
                2148916238 => "→ Compte suspendu/banni.",
                _ => ""
            };
            println!("[auth] xbl_auth FAIL {status} – XErr={x} – {:?} {hint}", err.Message);
            return Err(format!("xbl auth failed: {status} – XErr={x} – {}", err.Message.unwrap_or_default()));
        }
        println!("[auth] xbl_auth FAIL {status} – {text}");
        return Err(format!("xbl auth failed: {status} – {text}"));
    }

    println!("[auth] xbl_auth: success");
    let parsed: XblAuthResp = serde_json::from_str(&text)
        .map_err(|e| { println!("[auth] xbl_auth json err: {e} – body: {text}"); format!("json error: {e} – body: {text}") })?;
    let uhs = parsed.display_claims.xui.get(0).ok_or("xbl: missing uhs")?.uhs.clone();
    Ok((parsed.token, uhs))
}
/* -- 3) XSTS authorize -- */
#[derive(Deserialize)]
struct XstsAuthResp {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XuiClaims,
}
async fn xsts_auth(xbl_token: &str) -> Result<(String, String), String> {
    let body = json!({
    "Properties": {
      "SandboxId": "RETAIL",
      "UserTokens": [xbl_token]
    },
    "RelyingParty": "rp://api.minecraftservices.com/",
    "TokenType": "JWT"
  });
    let client = reqwest::Client::new();
    let res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("x-xbl-contract-version", "1")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("http error: {e}"))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("xsts auth failed: {status} – {text}"));
    }
    let parsed: XstsAuthResp =
        serde_json::from_str(&text).map_err(|e| format!("json error: {e} – body: {text}"))?;
    let uhs = parsed.display_claims.xui.get(0)
        .ok_or("xsts: missing uhs")?
        .uhs
        .clone();
    Ok((parsed.token, uhs))
}

/* -- 4) Minecraft login_with_xbox -- */
#[derive(Deserialize)]
struct McLoginResp {
    access_token: String,
    expires_in: u64,
    token_type: String,
}
async fn mc_login_with_xbox(uhs: &str, xsts: &str) -> Result<McLoginResp, String> {
    let body = json!({
    "identityToken": format!("XBL3.0 x={};{}", uhs, xsts)
  });
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("http error: {e}"))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("mc login failed: {status} – {text}"));
    }
    serde_json::from_str(&text).map_err(|e| format!("json error: {e} – body: {text}"))
}

/* -- 5) Vérifie la licence Minecraft -- */
#[derive(Deserialize)]
struct Entitlements { items: Vec<serde_json::Value> }
async fn mc_check_entitlement(mc_token: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.minecraftservices.com/entitlements/mcstore")
        .bearer_auth(mc_token)
        .send()
        .await
        .map_err(|e| format!("http error: {e}"))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("entitlements failed: {status} – {text}"));
    }
    let ent: Entitlements =
        serde_json::from_str(&text).map_err(|e| format!("json error: {e} – body: {text}"))?;
    if ent.items.is_empty() {
        return Err("Aucune licence Minecraft associée à ce compte.".into());
    }
    Ok(())
}

/* -- 6) Profil Minecraft -- */
#[derive(Deserialize)]
struct McProfileRaw {
    id: String,
    name: String,
    skins: Option<Vec<McSkin>>,
}
#[derive(Deserialize)]
struct McSkin { url: String, state: String }

async fn mc_fetch_profile(mc_token: &str) -> Result<McProfileLite, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send()
        .await
        .map_err(|e| format!("http error: {e}"))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("profile failed: {status} – {text}"));
    }
    let raw: McProfileRaw =
        serde_json::from_str(&text).map_err(|e| format!("json error: {e} – body: {text}"))?;

    let skin_url = raw.skins
        .and_then(|v| v.into_iter().find(|s| s.state == "ACTIVE"))
        .map(|s| s.url);

    Ok(McProfileLite { id: raw.id, name: raw.name, skin_url })
}

/* -- 7) Commande publique: tout faire et ne renvoyer que le profil -- */
#[tauri::command]
pub async fn mc_fetch_profile_from_refresh(app: tauri::AppHandle) -> Result<McProfileLite, String> {
    println!("[auth] chain: begin");
    let refresh = get_refresh_token(&app)
        .map_err(|_| { println!("[auth] chain: no refresh"); "Aucun refresh token stocké. Veuillez vous connecter.".to_string() })?;

    println!("[auth] chain: refresh present (len={})", refresh.len());
    let ms_access = ms_refresh_access_token(&refresh).await?;
    println!("[auth] chain: got ms_access (len={})", ms_access.len());

    let (xbl_token, _uhs1) = xbl_auth(&ms_access).await?;
    println!("[auth] chain: got xbl_token (len={})", xbl_token.len());

    let (xsts_token, uhs) = xsts_auth(&xbl_token).await?;
    println!("[auth] chain: got xsts (len={}), uhs={}", xsts_token.len(), uhs);

    let mc = mc_login_with_xbox(&uhs, &xsts_token).await?;
    println!("[auth] chain: mc login ok, access len={}", mc.access_token.len());

    mc_check_entitlement(&mc.access_token).await?;
    println!("[auth] chain: entitlement ok");

    let prof = mc_fetch_profile(&mc.access_token).await?;
    println!("[auth] chain: profile ok: {} ({})", prof.name, prof.id);
    Ok(prof)
}