import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BadgeCheck, Building2, Flame, MessageCircle, PenLine, Pencil, Upload, Users } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { profileStats, caseCardSelect, toCardView } from "@/server/services/dashboard";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CaseCard } from "@/components/cases/case-card";
import { FollowButton } from "@/components/profile/follow-button";
import { DESIGNATIONS } from "@/lib/validation/profile";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await db.userProfile.findUnique({ where: { username }, select: { displayName: true } });
  return { title: p ? p.displayName : "Profile" };
}

export default async function PublicProfilePage({ params }: Props) {
  const me = await requireOnboardedUser();
  const { username } = await params;
  const profile = await db.userProfile.findUnique({
    where: { username },
    include: { institution: true, user: { select: { id: true, status: true, image: true, createdAt: true, achievements: { include: { achievement: true }, take: 8 } } } },
  });
  if (!profile || profile.user.status !== "ACTIVE") notFound();

  const isSelf = profile.userId === me.id;
  const [stats, cases, isFollowing] = await Promise.all([
    profileStats(profile.userId),
    db.case.findMany({ where: { authorId: profile.userId, status: "PUBLISHED", deletedAt: null }, orderBy: { publishedAt: "desc" }, take: 6, select: caseCardSelect }),
    isSelf ? Promise.resolve(false) : db.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: profile.userId } } }).then(Boolean),
  ]);

  const designation = DESIGNATIONS.find((d) => d.value === profile.designation)?.label;
  const statItems = [
    { icon: Upload, label: "Cases", value: stats.cases },
    { icon: PenLine, label: "Observations", value: stats.observations },
    { icon: MessageCircle, label: "Comments", value: stats.comments },
    { icon: Users, label: "Followers", value: stats.followers },
    { icon: Users, label: "Following", value: stats.following },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-navy via-[#12395f] to-accent/70" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <span className="rounded-full ring-4 ring-surface"><Avatar name={profile.displayName} src={profile.avatarUrl ?? profile.user.image} size={88} /></span>
            {isSelf ? (
              <Button asChild variant="secondary"><Link href="/profile"><Pencil className="h-4 w-4" />Edit profile</Link></Button>
            ) : (
              <FollowButton username={profile.username} initialFollowing={isFollowing} />
            )}
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
              {profile.verificationStatus === "VERIFIED" && <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" />Verified</Badge>}
            </div>
            <p className="text-sm text-muted">@{profile.username} · {designation}{profile.qualification ? ` · ${profile.qualification}` : ""}</p>
            {profile.institution && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted"><Building2 className="h-4 w-4" />{profile.institution.name}{profile.institution.city ? `, ${profile.institution.city}` : ""}</p>
            )}
            {profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>}
            {profile.interests.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">{profile.interests.map((i) => <Badge key={i} tone="accent">{i}</Badge>)}</div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statItems.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-4">
            <Icon className="h-4 w-4 text-accent" />
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </Card>
        ))}
        <Card className="p-4">
          <Flame className="h-4 w-4 text-accent" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{profile.streakDays}<span className="ml-1 text-sm font-normal text-muted">d</span></p>
          <p className="text-xs text-muted">Learning streak</p>
        </Card>
      </div>

      {profile.user.achievements.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Achievements</h2>
          <div className="flex flex-wrap gap-2">
            {profile.user.achievements.map(({ achievement: a }) => <Badge key={a.id} tone="accent" title={a.description}><Award className="h-3.5 w-3.5" />{a.name}</Badge>)}
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold tracking-tight">Contributed cases</h2>
        {cases.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cases.map((c) => <CaseCard key={c.id} c={toCardView(c)} />)}</div>
        ) : (
          <Card><EmptyState icon={Upload} title="No published cases" description={isSelf ? "Share a de-identified case to start building your profile." : "This member hasn't published a case yet."} /></Card>
        )}
      </section>
    </div>
  );
}
