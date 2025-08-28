import {Routes, Route, useLocation} from "react-router-dom";
import Home from "./pages/Home";
import VMs from "./pages/vms/VMs.tsx";
import TopBar from "./components/TopBar.tsx";
import AuthLoading from "./pages/minecraft/AuthLoading.tsx";
import {AnimatePresence} from "framer-motion";
import PageTransition from "./ui/PageTransition.tsx";

export default function App() {
    const location = useLocation();
    return (
        <div className="app">
            <TopBar />
            <div className="content">
                <AnimatePresence mode="wait">
                    <Routes location={location} key={location.pathname}>
                        <Route path="/" element={<PageTransition><Home/></PageTransition>} />
                        <Route path="/minecraft" element={<PageTransition><AuthLoading/></PageTransition>} />
                        <Route path="/vms" element={<PageTransition><VMs/></PageTransition>} />
                    </Routes>
                </AnimatePresence>
            </div>
        </div>
    );
}