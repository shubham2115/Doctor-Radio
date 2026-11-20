import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Only same-site relative paths are allowed as post-login targets (prevents open redirects). */
function safeCallback(url?: string) {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/home";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  if ((await auth())?.user) redirect(safeCallback(callbackUrl));
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return <LoginForm googleEnabled={googleEnabled} callbackUrl={safeCallback(callbackUrl)} />;
}
