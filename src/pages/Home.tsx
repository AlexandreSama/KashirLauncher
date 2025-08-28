import { useNavigate } from "react-router-dom";

export default function Home() {
    const nav = useNavigate();

    return (
        <main className="home">
            {/* Minecraft */}
            <section
                className="hero-card"
                onClick={() => nav("/minecraft")}
                style={{ backgroundImage: `url('/minecraft.png')` }}
                aria-label="Aller au Launcher Minecraft"
            >
                <div className="hero-overlay" />
                <div className="hero-content">
                    <h2>Minecraft</h2>
                    <p>Lancer, gérer les versions, mods, profils…</p>
                    <button className="primary">Se connecter</button>
                </div>
            </section>

            {/* VMs */}
            <section
                className="hero-card"
                onClick={() => nav("/vms")}
                style={{ backgroundImage: `url('/phoenix.png')` }}
                aria-label="Aller au Gestionnaire de VM"
            >
                <div className="hero-overlay" />
                <div className="hero-content">
                    <h2>Gestionnaire VM</h2>
                    <p>Proxmox : créer, cloner, console noVNC…</p>
                    <button className="danger">Se connecter</button>
                </div>
            </section>
        </main>
    );
}
