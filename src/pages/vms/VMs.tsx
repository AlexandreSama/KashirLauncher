import { Link } from "react-router-dom";

export default function VMs() {
    return (
        <div className="page">
            <h1>Gestionnaire de VM</h1>
            <p>🖥️ Ici on listera les nœuds/VMs Proxmox, actions (start/stop/clone), console noVNC.</p>
            <Link to="/" className="link">← Retour accueil</Link>
        </div>
    );
}