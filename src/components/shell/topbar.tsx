"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Menu, Search, Settings, ShieldCheck, User as UserIcon, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "./sidebar";

type Props = {
  name: string;
  username: string;
  image?: string | null;
  designation: string;
  unread: number;
  isStaff: boolean;
};

const menuItem =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg outline-none data-[highlighted]:bg-surface-2";

export function Topbar({ name, username, image, designation, unread, isStaff }: Props) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (q) router.push(`/explore?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-xl sm:px-6">
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Trigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface p-4 shadow-[var(--shadow-lg)]">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main site navigation</Dialog.Description>
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo href="/home" />
              <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close menu"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>
            <NavLinks onNavigate={() => setDrawer(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <form onSubmit={onSearch} role="search" className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          name="q"
          type="search"
          maxLength={200}
          placeholder="Search cases — “MRI brain ring-enhancing lesion”"
          className="h-10 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Link href="/notifications">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bg" />}
          </Link>
        </Button>

        <Dropdown.Root>
          <Dropdown.Trigger className="ml-1 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]" aria-label="Account menu">
            <Avatar name={name} src={image} size={36} />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lg)]">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-muted">{designation}</p>
              </div>
              <Dropdown.Separator className="my-1 h-px bg-border" />
              <Dropdown.Item asChild className={menuItem}><Link href={`/u/${username}`}><UserIcon className="h-4 w-4" /> Public profile</Link></Dropdown.Item>
              <Dropdown.Item asChild className={menuItem}><Link href="/profile"><Settings className="h-4 w-4" /> Edit profile</Link></Dropdown.Item>
              {isStaff && <Dropdown.Item asChild className={menuItem}><Link href="/admin"><ShieldCheck className="h-4 w-4" /> Moderation</Link></Dropdown.Item>}
              <Dropdown.Separator className="my-1 h-px bg-border" />
              <Dropdown.Item className={menuItem} onSelect={() => signOut({ callbackUrl: "/login" })}><LogOut className="h-4 w-4" /> Sign out</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}
