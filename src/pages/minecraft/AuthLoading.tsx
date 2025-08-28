import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { open as openExternal } from "@tauri-apps/plugin-shell";

type DeviceStart = {
    user_code: string;
    device_code: string;
    verification_uri: string;
    expires_in: number;   // sec
    interval: number;     // sec
    message: string;
};

type Phase = "starting" | "waiting" | "linking" | "done" | "error";
type ErrorKind = "expired" | "generic";

export default function AuthLoading() {
    const nav = useNavigate();

    const [phase, setPhase] = useState<Phase>("starting");
    const [info, setInfo] = useState<DeviceStart | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
    const [copied, setCopied] = useState(false);
    const initial = useRef<number>(0);
    const [secondsLeft, setSecondsLeft] = useState<number>(0);
    const openedSystemRef = useRef<boolean>(false);
    const cancelledRef = useRef<boolean>(false);
    const timerRef = useRef<number | null>(null);

    const mmss = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const progress = useMemo(() => {
        if (!initial.current) return 0;
        const p = Math.max(0, Math.min(100, (1 - secondsLeft / initial.current) * 100));
        return Math.round(p);
    }, [secondsLeft]);

    const tryOpen = async (url: string) => {
        try {
            await openExternal(url);         // navigateur système
            openedSystemRef.current = true;
        } catch {
            window.open(url, "_blank");      // fallback
            openedSystemRef.current = false;
        }
    };

    const stopTimer = () => {
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startSequence = async () => {
        // reset état
        cancelledRef.current = false;
        setPhase("starting");
        setError(null);
        setErrorKind("generic");
        setInfo(null);
        initial.current = 0;
        setSecondsLeft(0);

        try {
            // Étape 1 : device code
            const start = await invoke<DeviceStart>("mc_ms_start_device_code");
            if (cancelledRef.current) return;

            setInfo(start);
            initial.current = start.expires_in;
            setSecondsLeft(start.expires_in);

            await tryOpen(start.verification_uri);

            // compteur visuel
            stopTimer();
            timerRef.current = window.setInterval(() => {
                setSecondsLeft((s) => Math.max(0, s - 1));
            }, 1000) as unknown as number;

            setPhase("waiting");

            // Attend la validation (stocke le refresh token côté Rust)
            await invoke("mc_ms_poll_and_store", {
                args: {
                    device_code: start.device_code,
                    interval_secs: start.interval,
                    timeout_secs: Math.min(start.expires_in, 600)
                }
            });
            if (cancelledRef.current) return;

            // Étape 2 : chaîne → profil
            setPhase("linking");
            await invoke("mc_fetch_profile_from_refresh");
            if (cancelledRef.current) return;

            setPhase("done");
            stopTimer();
            nav("/minecraft", { replace: true });
        } catch (e: any) {
            if (cancelledRef.current) return;
            const msg = String(e || "");
            setError(msg);
            setErrorKind(msg.toLowerCase().includes("expired") ? "expired" : "generic");
            setPhase("error");
            stopTimer();
        }
    };

    useEffect(() => {
        startSequence();
        return () => {
            cancelledRef.current = true;
            stopTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nav]);

    const handleCopy = async () => {
        if (!info) return;
        try {
            await navigator.clipboard.writeText(info.user_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {}
    };

    const handleBack = () => {
        cancelledRef.current = true; // on ignore les résolutions tardives
        stopTimer();
        nav(-1); // ou nav("/minecraft")
    };

    const actionsDisabled = cancelledRef.current || phase === "linking" || phase === "done";

    // Badge selon la phase
    const stepPill =
        phase === "linking" || phase === "done"
            ? <span className="pill live">Étape 2/2</span>
            : <span className="pill alpha">Étape 1/2</span>;

    return (
        <div className="page" style={{ maxWidth: 780 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h1 style={{ margin: 0 }}>Connexion à Minecraft</h1>
                <button className="btn" onClick={handleBack} disabled={actionsDisabled}>← Retour</button>
            </div>

            <div className="auth-card" role="region" aria-live="polite" style={{ marginTop: 12 }}>
                <div className="auth-head">
                    {stepPill}
                    <span className="muted">
            {phase === "starting" && "Initialisation…"}
                        {phase === "waiting" &&
                            `Valide la connexion dans ${openedSystemRef.current ? "le navigateur" : "la fenêtre"}…`}
                        {phase === "linking" && "Finalisation de la connexion et récupération du profil…"}
                        {phase === "done" && "Connexion réussie."}
          </span>
                </div>

                {/* Étape 1 visible uniquement pendant starting/waiting */}
                {(phase === "starting" || phase === "waiting") && info && (
                    <>
                        <p className="muted">{info.message}</p>
                        <div className="auth-code-row">
                            <code className="auth-code" aria-label="Code de vérification Microsoft">
                                {info.user_code}
                            </code>
                            <div className="auth-actions">
                                <button className="btn" onClick={handleCopy} disabled={actionsDisabled}>
                                    {copied ? "Copié ✓" : "Copier le code"}
                                </button>
                                <button
                                    className="primary"
                                    onClick={async () => { if (info && !actionsDisabled) await tryOpen(info.verification_uri); }}
                                    disabled={actionsDisabled}
                                >
                                    Ouvrir Microsoft
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Progress & statut (affiché aussi pendant linking) */}
                <div className="auth-progress">
                    <div className="auth-progress-bar">
                        <div className="auth-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="auth-status">
                        {(phase === "waiting" || phase === "linking") && (<><span className="spinner" /> </>)}
                        {phase === "waiting" && <span>En attente de validation…</span>}
                        {phase === "linking" && <span>Connexion à Minecraft…</span>}
                        {info && phase === "waiting" && <span className="muted">Expire dans {mmss(secondsLeft)}</span>}
                    </div>
                </div>

                {/* Erreurs */}
                {phase === "error" && (
                    <div className="auth-error" role="alert">
                        <strong>Échec de la connexion :</strong>
                        <div className="muted" style={{ marginTop: 6 }}>{error}</div>

                        <div className="auth-actions" style={{ marginTop: 12 }}>
                            {errorKind === "expired" ? (
                                <button className="primary" onClick={startSequence}>Recommencer</button>
                            ) : (
                                <>
                                    <button className="btn" onClick={() => location.reload()}>Réessayer</button>
                                    <button className="btn" onClick={handleBack}>Retour</button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
