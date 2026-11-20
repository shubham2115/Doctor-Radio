import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, HttpError, limit, route } from "@/server/http";
import { db } from "@/server/db";

type Ctx = { params: Promise<{ username: string }> };

async function target(username: string, selfId: string) {
  const p = await db.userProfile.findUnique({ where: { username }, select: { userId: true } });
  if (!p) throw new HttpError(404, "User not found");
  if (p.userId === selfId) throw new HttpError(400, "You cannot follow yourself");
  return p.userId;
}

export async function POST(req: Request, { params }: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const me = await apiUser();
    await limit(req, "follow", 120, 60 * 60);
    const followingId = await target((await params).username, me.id);
    await db.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId } },
      create: { followerId: me.id, followingId },
      update: {},
    });
    await db.notification.create({
      data: { recipientId: followingId, actorId: me.id, type: "NEW_FOLLOWER", message: "started following you" },
    });
    return NextResponse.json({ following: true });
  })(req);
}

export async function DELETE(req: Request, { params }: Ctx) {
  return route(async () => {
    assertSameOrigin(req);
    const me = await apiUser();
    const followingId = await target((await params).username, me.id);
    await db.follow.deleteMany({ where: { followerId: me.id, followingId } });
    return NextResponse.json({ following: false });
  })(req);
}
