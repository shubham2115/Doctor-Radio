import { db } from "@/server/db";
import { requireOnboardedUser } from "@/server/dal";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { PageTransition } from "@/components/shell/page-transition";
import { DESIGNATIONS } from "@/lib/validation/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardedUser();
  const unread = await db.notification.count({ where: { recipientId: user.id, readAt: null } });
  const designation = DESIGNATIONS.find((d) => d.value === user.profile.designation)?.label ?? "";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={user.profile.displayName}
          username={user.profile.username}
          image={user.profile.avatarUrl ?? user.image}
          designation={designation}
          unread={unread}
          isStaff={user.role !== "MEMBER"}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
