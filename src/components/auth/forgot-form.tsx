"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

export function ForgotForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/forgot-password", "POST", { email: String(new FormData(e.currentTarget).get("email")) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent)
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><MailCheck className="h-6 w-6" /></div>
        <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
        <p className="mt-2 text-sm text-muted">If an account exists for that address, we&apos;ve sent a link to reset your password. It expires in 30 minutes.</p>
        <Button asChild variant="secondary" className="mt-6"><Link href="/login">Back to sign in</Link></Button>
      </div>
    );

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">Forgot your password?</h2>
      <p className="mt-1.5 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@hospital.org" />
          <FieldError message={error} />
        </div>
        <Button type="submit" className="w-full" loading={loading}>Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="font-medium text-accent hover:underline">Back to sign in</Link></p>
    </>
  );
}
