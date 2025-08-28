import { motion } from "framer-motion";
import React from "react";

type Props = { children: React.ReactNode };

export default function PageTransition({ children }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.995, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, scale: 0.995, filter: "blur(6px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "opacity, transform, filter" }}
        >
            {children}
        </motion.div>
    );
}