import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/dal";
import { ProfileForm } from "@/components/profile/profile-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile) redirect("/home");

  const suggested = (user.email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between"><Logo href="/" /><ThemeToggle /></div>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Tell us about your practice</h1>
        <p className="mt-2 text-muted">This helps us tailor cases to your level and lets peers know who they&apos;re learning with.</p>
        <Card className="mt-8 p-6 sm:p-8">
          <ProfileForm
            mode="onboarding"
            initial={{
              username: suggested.length >= 3 ? suggested : "",
              displayName: user.name ?? "",
              designation: "PG1",
              qualification: "",
              institutionName: "",
              institutionCity: "",
              yearsExperience: "",
              bio: "",
              interests: [],
            }}
          />
        </Card>
      </div>
    </div>
  );
}
