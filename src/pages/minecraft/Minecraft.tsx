import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";

type McProfileLite = { id: string; name: string; skin_url?: string | null };

type Server = {
    id: string;
    name: string;
    address: string;
    note?: string;
};

type ProgressPayload = {
    step: string;        // e.g. "vérification", "téléchargement", "lancement"
    percent: number;     // 0..100
    detail?: string;     // texte libre
};

export default function Minecraft() {
    const nav = useNavigate();

    const [profile, setProfile] = useState<McProfileLite | null>(null);
    const [servers] = useState<Server[]>([
        { id: "s1", name: "Kashir — Vanilla", address: "play.kashir.gg", note: "1.20.4" },
        { id: "s2", name: "Kashir — Moddé", address: "mod.kashir.gg", note: "Fabric" },
        { id: "s3", name: "Communauté FR", address: "fr.example.net", note: "Paper" }
    ]);
    const [selectedServer, setSelectedServer] = useState<string>("s1");

    const [ramMb, setRamMb] = useState<number>(4096);
    const [log, setLog] = useState<string>("Prêt.");
    const [isLaunching, setIsLaunching] = useState(false);
    const [progress, setProgress] = useState<ProgressPayload | null>(null);

    const unsubsRef = useRef<(() => void)[]>([]);

    // charge le profil (via refresh token stocké côté Rust)
    useEffect(() => {
        (async () => {
            try {
                const p = await invoke<McProfileLite>("mc_fetch_profile_from_refresh");
                setProfile(p);
            } catch {
                setProfile(null);
            }
        })();
    }, []);

    // écoute les events de progression
    useEffect(() => {
        // clean anciens listeners (au cas où)
        unsubsRef.current.forEach(u => u());
        unsubsRef.current = [];

        (async () => {
            const un1 = await listen<ProgressPayload>("mc://progress", (e) => {
                setProgress(e.payload);
                setLog((prev) => `${prev}\n[${e.payload.percent}%] ${e.payload.step}${e.payload.detail ? " — " + e.payload.detail : ""}`);
            });
            const un2 = await listen<{ line: string }>("mc://log", (e) => {
                setLog((prev) => `${prev}\n${e.payload.line}`);
            });
            const un3 = await listen<{ ok: boolean; error?: string }>("mc://done", (e) => {
                setIsLaunching(false);
                if (!e.payload.ok) {
                    setLog((prev) => `${prev}\n✖ Échec: ${e.payload.error ?? "inconnu"}`);
                } else {
                    setLog((prev) => `${prev}\n✔ Lancement terminé`);
                }
            });
            unsubsRef.current.push(un1, un2, un3);
        })();

        return () => {
            unsubsRef.current.forEach(u => u());
            unsubsRef.current = [];
        };
    }, []);

    const shortName = useMemo(() => profile?.name ?? "Joueur", [profile]);

    const onLogout = async () => {
        try { await invoke("auth_logout"); } catch {}
        nav("/auth", { replace: true });
    };

    const onPlay = async () => {
        if (!selectedServer || isLaunching) return;
        setIsLaunching(true);
        setLog(`Connexion au serveur “${servers.find(s => s.id === selectedServer)?.name}”…`);
        setProgress({ step: "initialisation", percent: 0 });

        try {
            await invoke("mc_launch_server", {
                args: { server_id: selectedServer, ram_mb: ramMb }
            });
        } catch (e: any) {
            setIsLaunching(false);
            setLog((prev) => `${prev}\n✖ Erreur: ${String(e)}`);
        }
    };

    if (!profile) {
        return (
            <div className="page" style={{ maxWidth: 760 }}>
                <h1>Minecraft</h1>
                <div className="auth-card" style={{ marginTop: 12 }}>
                    <p className="muted">Vous n’êtes pas connecté.</p>
                    <div className="auth-actions">
                        <button className="primary" onClick={() => nav("/auth")}>Se connecter à Minecraft</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page mc-page">
            {/* Bandeau profil + actions */}
            <div className="mc-hero">
                <div className="mc-user">
                    <div className="mc-skin">
                        {profile.skin_url ? <img src={profile.skin_url} alt="Skin" /> : <div className="mc-skin-ph" />}
                    </div>
                    <div className="mc-id">
                        <div className="brand">{shortName}</div>
                        <div className="muted" style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span className="pill live">Connecté</span>
                            <span className="muted">Java Edition</span>
                        </div>
                    </div>
                </div>
                <div className="mc-cta">
                    <button className="play-btn" onClick={onPlay} disabled={isLaunching}>Jouer</button>
                    <button className="btn" onClick={onLogout}>Se déconnecter</button>
                </div>
            </div>

            {/* Grid principale */}
            <div className="mc-grid">
                {/* Serveur */}
                <section className="card">
                    <header className="card-head">
                        <h3>Serveur</h3>
                        <button className="btn" onClick={() => alert("À venir : gestion des serveurs (ajout, édition, icônes).")}>Gérer</button>
                    </header>
                    <div className="card-body">
                        <label className="label">Choisir un serveur</label>
                        <select
                            className="select"
                            value={selectedServer}
                            onChange={(e) => setSelectedServer(e.target.value)}
                            disabled={isLaunching}
                        >
                            {servers.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} — {s.address}{s.note ? ` (${s.note})` : ""}
                                </option>
                            ))}
                        </select>

                        <div className="mc-row">
                            <div style={{ flex: 1 }}>
                                <label className="label">Mémoire (RAM)</label>
                                <input
                                    className="range"
                                    type="range"
                                    min={2048}
                                    max={16384}
                                    step={256}
                                    value={ramMb}
                                    onChange={(e) => setRamMb(parseInt(e.target.value, 10))}
                                    disabled={isLaunching}
                                />
                                <div className="muted">{(ramMb/1024).toFixed(1)} Go</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Progression */}
                <section className="card">
                    <header className="card-head">
                        <h3>Progression</h3>
                        <span className={`pill ${isLaunching ? "beta" : "dev"}`}>
              {isLaunching ? "En cours" : "En attente"}
            </span>
                    </header>
                    <div className="card-body">
                        <div className="auth-progress">
                            <div className="auth-progress-bar">
                                <div className="auth-progress-fill" style={{ width: `${progress?.percent ?? 0}%` }} />
                            </div>
                            <div className="auth-status">
                                {isLaunching && <span className="spinner" />}
                                <span>{progress?.step ?? "Prêt."}</span>
                                {progress?.detail && <span className="muted"> — {progress.detail}</span>}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Journal */}
                <section className="card mc-log">
                    <header className="card-head">
                        <h3>Journal</h3>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn" onClick={() => setLog("Prêt.")} disabled={isLaunching}>Effacer</button>
                        </div>
                    </header>
                    <pre className="logbox">{log}</pre>
                </section>
            </div>
        </div>
    );
}
