"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {active && (
              <motion.span layoutId="nav-active" className="absolute inset-0 rounded-[10px] bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
            <Icon className={cn("relative h-[18px] w-[18px]", active && "text-accent")} />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 lg:flex">
      <div className="px-3 pb-6"><Logo href="/home" /></div>
      <NavLinks />
      <div className="mt-auto rounded-xl border border-border bg-surface-2/60 p-3 text-xs leading-relaxed text-muted">
        Educational platform. Always upload <span className="font-medium text-fg">de-identified</span> cases only.
      </div>
    </aside>
  );
}
