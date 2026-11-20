"use client";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" className="w-full" onClick={() => signIn("google", { callbackUrl: "/home" })}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4Z" />
        <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1a6.8 6.8 0 0 1-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5Z" />
        <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
        <path fill="#EA4335" d="M12 5.4c1.7 0 3.3.6 4.5 1.8l3.4-3.4A11.4 11.4 0 0 0 12 .5 11.5 11.5 0 0 0 1.8 6.8l3.8 3A6.8 6.8 0 0 1 12 5.4Z" />
      </svg>
      {label}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-subtle">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}
