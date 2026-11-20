import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/dal";
import { ProfileForm } from "@/components/profile/profile-form";
import { VerificationCard } from "@/components/profile/verification-card";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const user = await requireOnboardedUser();
  const p = user.profile;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={p.displayName} src={p.avatarUrl ?? user.image} size={64} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit profile</h1>
          <p className="text-sm text-muted">This is how other members see you. @{p.username}</p>
        </div>
      </div>
      <Card className="p-6">
        <ProfileForm
          mode="edit"
          initial={{
            username: p.username,
            displayName: p.displayName,
            designation: p.designation,
            qualification: p.qualification ?? "",
            institutionName: p.institution?.name ?? "",
            institutionCity: p.institution?.city ?? "",
            yearsExperience: p.yearsExperience?.toString() ?? "",
            bio: p.bio ?? "",
            interests: p.interests,
          }}
        />
      </Card>
      <VerificationCard status={p.verificationStatus} />
    </div>
  );
}
