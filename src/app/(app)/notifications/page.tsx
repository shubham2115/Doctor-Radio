import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireOnboardedUser();
  const items = await db.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { name: true, image: true } } },
  });
  // Opening the page marks everything as read.
  await db.notification.updateMany({ where: { recipientId: user.id, readAt: null }, data: { readAt: new Date() } });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <Card className="divide-y divide-border">
        {items.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" description="Replies, mentions and new followers will show up here." />
        ) : (
          items.map((n) => (
            <div key={n.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={n.actor?.name} src={n.actor?.image} size={36} />
              <p className="min-w-0 flex-1 text-sm"><span className="font-medium">{n.actor?.name ?? "Doctor Radio"}</span> {n.message}</p>
              <span className="shrink-0 text-xs text-subtle">{timeAgo(n.createdAt)}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
