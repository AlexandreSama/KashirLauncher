import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/* ===== Types d'events côté Rust ===== */
type ProgressPayload = { step: string; percent: number; detail?: string | null };
type LogPayload = { line: string };
type DonePayload = { ok: boolean; error?: string | null };

/* ===== Profil (light) ===== */
type McProfileLite = {
    id: string;
    name: string;
    skin_url?: string | null;
};

/* ===== Données serveurs (dummy) ===== */
type ServerId = "vanilla" | "fabric" | "forge";
type ServerDef = {
    id: ServerId;
    name: string;
    tagline: string;
    version: string;
    badge: string;
    defaultRamGo: number;
    avatar: string; // simple lettre/emoji
    changelog: { date: string; items: string[] }[];
};

const SERVERS: ServerDef[] = [
    {
        id: "vanilla",
        name: "Vanilla",
        tagline: "Pur Minecraft, sans mods",
        version: "vanilla-1.20.6",
        badge: "Vanilla",
        defaultRamGo: 4,
        avatar: "V",
        changelog: [
            { date: "2025-08-20", items: ["MàJ datapacks de spawn", "Correctif sons d’ambiances"] },
            { date: "2025-08-10", items: ["Reset Nether", "Nettoyage fichiers inutiles"] },
        ],
    },
    {
        id: "fabric",
        name: "Fabric",
        tagline: "Léger & rapide (mods compatibles Fabric)",
        version: "fabric-0.15.x (MC 1.20.6)",
        badge: "Fabric",
        defaultRamGo: 8,
        avatar: "F",
        changelog: [
            { date: "2025-08-21", items: ["Ajout Lithium", "MàJ Sodium 0.5.x"] },
            { date: "2025-08-05", items: ["Correction crash shaders"] },
        ],
    },
    {
        id: "forge",
        name: "Forge",
        tagline: "Pack lourd (mods Forge)",
        version: "forge-47.x (MC 1.20.1)",
        badge: "Forge",
        defaultRamGo: 10,
        avatar: "F",
        changelog: [
            { date: "2025-08-18", items: ["MàJ Create", "Compat JEI 15.x"] },
            { date: "2025-08-01", items: ["Rewrite config performance"] },
        ],
    },
];

const byId = Object.fromEntries(SERVERS.map(s => [s.id, s]));

/* ===== Composant principal ===== */
export default function Minecraft() {
    const [profile, setProfile] = useState<McProfileLite | null>(null);
    const [connected, setConnected] = useState<boolean>(false);

    const [selected, setSelected] = useState<ServerId>("vanilla");

    // RAM par serveur (Go), persistance locale
    const [ramByServer, setRamByServer] = useState<Record<string, number>>({});
    useEffect(() => {
        try {
            const s = localStorage.getItem("ramByServer");
            if (s) setRamByServer(JSON.parse(s));
        } catch {}
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem("ramByServer", JSON.stringify(ramByServer));
        } catch {}
    }, [ramByServer]);

    const server = byId[selected];
    const ramGo = ramByServer[selected] ?? server.defaultRamGo;

    // Onglet actif (overview/changelog/logs) + persistance par serveur
    type Tab = "overview" | "changelog" | "logs";
    const [tab, setTab] = useState<Tab>("overview");
    useEffect(() => {
        try {
            const k = `tab:${selected}`;
            const t = localStorage.getItem(k) as Tab | null;
            if (t) setTab(t);
            else setTab("overview");
        } catch {}
    }, [selected]);
    useEffect(() => {
        try {
            localStorage.setItem(`tab:${selected}`, tab);
        } catch {}
    }, [tab, selected]);

    // Lancement & progression
    const [launching, setLaunching] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState<string>("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const logRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll des logs
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    // Charger profil si possible (sinon dummy)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const ok = await invoke<boolean>("auth_is_connected");
                if (!mounted) return;
                setConnected(ok);
                if (ok) {
                    const p = await invoke<McProfileLite>("mc_fetch_profile_from_refresh");
                    if (!mounted) return;
                    setProfile(p);
                } else {
                    // Dummy si pas connecté
                    setProfile({
                        id: "0000-0000-FAKE",
                        name: "Player42",
                        skin_url: null,
                    });
                }
            } catch {
                // Fallback dummy
                if (mounted) {
                    setConnected(false);
                    setProfile({ id: "0000-0000-FAKE", name: "Player42", skin_url: null });
                }
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Écoute des events Tauri
    useEffect(() => {
        const unsubs: UnlistenFn[] = [];
        (async () => {
            try {
                unsubs.push(
                    await listen<ProgressPayload>("mc://progress", (e) => {
                        const { percent, step, detail } = e.payload;
                        setProgress(Math.max(0, Math.min(100, Math.round(percent))));
                        setStage(detail ? `${step} – ${detail}` : step);
                    })
                );
                unsubs.push(
                    await listen<LogPayload>("mc://log", (e) => {
                        setLogs((cur) => [...cur, e.payload.line]);
                    })
                );
                unsubs.push(
                    await listen<DonePayload>("mc://done", (e) => {
                        setLaunching(false);
                        setProgress(100);
                        if (!e.payload.ok) {
                            setLogs((cur) => [...cur, `\n[ERREUR] ${e.payload.error ?? "inconnue"}`]);
                            setTab("logs");
                        }
                    })
                );
            } catch (err) {
                // Si permissions manquantes, on ne crashe pas l’UI
                console.error("[mc] listen events failed:", err);
            }
        })();
        return () => {
            unsubs.forEach((u) => u && u());
        };
    }, []);

    const onChangeRam = (next: number) => {
        setRamByServer((cur) => ({ ...cur, [selected]: next }));
    };

    const onPlay = async () => {
        if (launching) return;
        setLaunching(true);
        setProgress(0);
        setStage("préparation");
        setLogs([]);
        try {
            const ramMb = Math.round((ramGo || server.defaultRamGo) * 1024);
            await invoke("mc_launch_server", { args: { server_id: selected, ram_mb: ramMb } });
            // la suite se fait via les events
        } catch (e: any) {
            setLaunching(false);
            setStage("erreur");
            setLogs((cur) => [...cur, `[ERREUR] ${String(e)}`]);
            setTab("logs");
        }
    };

    const onLogout = async () => {
        try {
            await invoke("auth_logout");
            setConnected(false);
            setProfile({ id: "0000-0000-FAKE", name: "Player42", skin_url: null });
        } catch (e) {
            console.error(e);
        }
    };

    const progressPct = useMemo(() => `${Math.max(0, Math.min(100, progress))}%`, [progress]);

    return (
        <div className="minecraft-page-root">
            {/* FOND VIDÉO optionnel : ajoute ta source si tu veux
      <div className="video-bg">
        <video className="video-bg-el" autoPlay loop muted playsInline src="bg.mp4" />
      </div>
      <div className="video-bg-overlay" /> */}

            <div className="mc-layout">
                {/* ===== SIDEBAR ===== */}
                <aside className="mc-side glass">
                    <div className="mc-side-head">
                        <strong>Serveurs</strong>
                        <span className="pill alpha sm">ALPHA</span>
                    </div>
                    <div className="mc-side-scroll">
                        <ul className="srv-nav">
                            {SERVERS.map((s) => (
                                <li
                                    key={s.id}
                                    className={`srv-item ${selected === s.id ? "active" : ""}`}
                                    onClick={() => setSelected(s.id)}
                                >
                                    <div className="srv-avatar">{s.avatar}</div>
                                    <div className="srv-meta">
                                        <div className="srv-title">{s.name}</div>
                                        <div className="srv-sub">{s.tagline}</div>
                                    </div>
                                    <span className="srv-badge">{s.badge}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* ===== MAIN ===== */}
                <main className="mc-main">
                    {/* ENTÊTE (profil + actions) */}
                    <div className="mc-top glass">
                        <div className="mc-user">
                            <div className={`pfp ${profile?.skin_url ? "" : "pfp-fallback"}`}>
                                {profile?.skin_url ? (
                                    // tu peux remplacer par rendu skin cube + <img /> si tu as une URL
                                    <img
                                        alt="Skin"
                                        src={profile.skin_url}
                                        style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }}
                                    />
                                ) : (
                                    (profile?.name?.[0] ?? "P")
                                )}
                            </div>
                            <div className="mc-user-meta">
                                <div className="mc-user-line">
                                    <strong>{profile?.name ?? "Player"}</strong>
                                    <span className="pill live sm">{connected ? "Connecté" : "Hors ligne (dummy)"}</span>
                                </div>
                                <span className="muted">UUID: {profile?.id ?? "—"}</span>
                            </div>
                        </div>
                        <div className="mc-actions">
                            <button className="danger" onClick={onLogout}>Se déconnecter</button>
                        </div>
                    </div>

                    {/* CONTENU SERVEUR */}
                    <section className="glass">
                        <div className="mc-content">
                            {/* Header serveur */}
                            <div className="srv-header">
                                <div>
                                    <div className="srv-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        {server.name}
                                        {launching && <span className="pill beta sm">Lancement…</span>}
                                    </div>
                                    <div className="srv-meta-row">
                                        <span>Pur Minecraft, sans mods</span>
                                        <span className="sep" style={{ width: 1, height: 14, background: "rgba(255,255,255,.1)" }} />
                                        <span>RAM: <strong>{ramGo} Go</strong></span>
                                    </div>
                                </div>
                                <button className="btn">Profil</button>
                            </div>

                            {/* Tabs */}
                            <nav className="tabs" role="tablist" aria-label="Sections serveur">
                                {(["overview", "changelog", "logs"] as Tab[]).map((t) => (
                                    <button
                                        key={t}
                                        role="tab"
                                        aria-selected={tab === t}
                                        className={`tab-btn ${tab === t ? "active" : ""}`}
                                        onClick={() => setTab(t)}
                                    >
                                        {t === "overview" ? "Overview" : t === "changelog" ? "Changelog" : "Logs"}
                                    </button>
                                ))}
                            </nav>

                            {/* Panels */}
                            <div className="tab-panels">
                                {/* OVERVIEW */}
                                <section
                                    role="tabpanel"
                                    hidden={tab !== "overview"}
                                    className={`tab-panel ${tab === "overview" ? "active" : ""}`}
                                >
                                    <div className={`card ${launching ? "launching" : ""}`}>
                                        <div className="ram">
                                            <label>Mémoire allouée</label>
                                            <div className="ram-row">
                                                <input
                                                    type="range"
                                                    min={2}
                                                    max={16}
                                                    step={1}
                                                    value={ramGo}
                                                    onChange={(e) => onChangeRam(parseInt(e.target.value, 10))}
                                                    disabled={launching}
                                                    aria-label="Mémoire (Go)"
                                                    style={{ maxWidth: 360 }}
                                                />
                                                <strong style={{ minWidth: 36, textAlign: "right" }}>{ramGo} Go</strong>
                                            </div>
                                        </div>

                                        <div className="play-row">
                                            <div>
                                                <div className="muted">Serveur: <strong>{server.version}</strong></div>
                                                <div className="muted">Étape: <strong>{stage}</strong></div>
                                            </div>
                                            <button className="play-giant" onClick={onPlay} disabled={launching}>
                                                {launching ? "En cours…" : "Jouer"}
                                            </button>
                                        </div>

                                        {/* Progress */}
                                        <div className="progress-wide">
                                            <div className="progress-line">
                                                <span className="muted">Progression</span>
                                                <span className="progress-percent">{progressPct}</span>
                                            </div>
                                            <div className="progress-bar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                                                <div className="progress-fill" style={{ width: progressPct }} />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* CHANGELOG */}
                                <section
                                    role="tabpanel"
                                    hidden={tab !== "changelog"}
                                    className={`tab-panel ${tab === "changelog" ? "active" : ""}`}
                                >
                                    <div className="card">
                                        <div className="panel-head" style={{ marginBottom: 10 }}>
                                            <h3>Derniers changements</h3>
                                        </div>
                                        <div className="changelog">
                                            {server.changelog.map((entry) => (
                                                <div className="cl-entry" key={entry.date}>
                                                    <div className="cl-date">{entry.date}</div>
                                                    <ul className="cl-items">
                                                        {entry.items.map((it, i) => <li key={i}>{it}</li>)}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* LOGS */}
                                <section
                                    role="tabpanel"
                                    hidden={tab !== "logs"}
                                    className={`tab-panel ${tab === "logs" ? "active" : ""}`}
                                >
                                    <div className="card">
                                        <div className="panel-head">
                                            <h3>Logs de lancement</h3>
                                            <div className="tb2-actions">
                                                <button className="btn" onClick={() => navigator.clipboard.writeText(logs.join("\n"))}>
                                                    Copier
                                                </button>
                                                <button className="btn" onClick={() => setLogs([])}>
                                                    Vider
                                                </button>
                                            </div>
                                        </div>
                                        <div className="logbox" ref={logRef} aria-live="polite">
                                            {logs.length === 0 ? (
                                                <div className="muted">Aucun log pour le moment.</div>
                                            ) : (
                                                logs.map((ln, idx) => (
                                                    <div className="logline" key={idx}>
                                                        {ln}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
