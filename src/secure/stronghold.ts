import { Stronghold, Client } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

let cachedPassword: string | null = null;

async function getDeviceSecret(): Promise<string> {
    if (cachedPassword) return cachedPassword;
    const secret = await invoke<string>("ks_get_device_secret");
    cachedPassword = secret;
    return secret;
}

async function openVault() {
    const password = await getDeviceSecret();
    const path = `${await appDataDir()}/vault.hold`;
    const stronghold = await Stronghold.load(path, password);
    let client: Client;
    const name = "kashir";
    try { client = await stronghold.loadClient(name); }
    catch { client = await stronghold.createClient(name); }
    const store = client.getStore();
    return { stronghold, store };
}

function enc(text: string): number[] {
    return Array.from(new TextEncoder().encode(text));
}
function dec(bytes?: Uint8Array<ArrayBufferLike> | null): string | null {
    if (!bytes) return null;
    return new TextDecoder().decode(new Uint8Array(bytes));
}

export async function saveMsTokensSecure(accessToken: string, refreshToken?: string | null) {
    const { stronghold, store } = await openVault();
    await store.insert("ms_access_token", enc(accessToken));
    if (refreshToken) await store.insert("ms_refresh_token", enc(refreshToken));
    await stronghold.save();
}

export async function readMsTokenSecure(key: "ms_access_token" | "ms_refresh_token") {
    const { stronghold, store } = await openVault();
    const val = await store.get(key);
    await stronghold.save();
    return dec(val);
}

export async function clearMsTokens() {
    const { stronghold, store } = await openVault();
    await store.remove("ms_access_token");
    await store.remove("ms_refresh_token");
    await stronghold.save();
}
