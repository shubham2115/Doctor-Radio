"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function FollowButton({ username, initialFollowing }: { username: string; initialFollowing: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next); // optimistic
    start(async () => {
      try {
        await api(`/api/follow/${username}`, next ? "POST" : "DELETE");
        router.refresh();
      } catch {
        setFollowing(!next);
        toast.error("Couldn't update follow status");
      }
    });
  }

  return (
    <Button variant={following ? "secondary" : "primary"} onClick={toggle} disabled={pending} aria-pressed={following}>
      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
