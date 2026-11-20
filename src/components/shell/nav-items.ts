import { BookOpen, Compass, Home, MessagesSquare, Trophy, Upload, User, type LucideIcon } from "lucide-react";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore Cases", icon: Compass },
  { href: "/cases/new", label: "Upload Case", icon: Upload },
  { href: "/discussions", label: "Discussions", icon: MessagesSquare },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "My Profile", icon: User },
];
