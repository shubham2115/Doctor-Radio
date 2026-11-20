"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/reset-password", "POST", { token, password: String(new FormData(e.currentTarget).get("password")) });
      toast.success("Password updated. Please sign in.");
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors?.password?.[0] ?? err.message) : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token)
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Invalid link</h2>
        <p className="mt-2 text-sm text-muted">This reset link is missing its token.</p>
        <Button asChild variant="secondary" className="mt-6"><Link href="/forgot-password">Request a new link</Link></Button>
      </div>
    );

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
      <p className="mt-1.5 text-sm text-muted">10+ characters with upper, lower case and a number.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!error} />
          <FieldError message={error} />
        </div>
        <Button type="submit" className="w-full" loading={loading}>Update password</Button>
      </form>
    </>
  );
}
