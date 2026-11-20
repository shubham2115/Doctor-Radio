"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { GoogleButton, OrDivider } from "./google-button";

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError("");
    const f = new FormData(e.currentTarget);
    const payload = { name: String(f.get("name")), email: String(f.get("email")), password: String(f.get("password")) };
    try {
      await api("/api/auth/register", "POST", payload);
      const res = await signIn("credentials", { email: payload.email.trim().toLowerCase(), password: payload.password, redirect: false });
      if (res?.error) throw new ApiError("Account created, but sign-in failed. Please sign in.", 400);
      toast.success("Account created");
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors ?? {});
        if (!err.fieldErrors) setFormError(err.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-sm text-muted">Join radiologists learning from every case.</p>
      <div className="mt-8">
        {googleEnabled && (
          <>
            <GoogleButton label="Sign up with Google" />
            <OrDivider />
          </>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" required aria-invalid={!!errors.name} placeholder="Dr. Anjali Mehta" />
            <FieldError message={errors.name?.[0]} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} placeholder="you@hospital.org" />
            <FieldError message={errors.email?.[0]} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
            {errors.password ? <FieldError message={errors.password[0]} /> : <p className="mt-1.5 text-xs text-subtle">10+ characters with upper, lower case and a number.</p>}
          </div>
          {formError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <Button type="submit" className="w-full" loading={loading}>Create account</Button>
          <p className="text-center text-xs text-subtle">
            By continuing you agree this platform is for professional education and that you will only share de-identified cases.
          </p>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Already a member? <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
      </p>
    </>
  );
}
