"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

/** Subtle fade/slide on route change. Keyed by pathname so it replays on navigation. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
