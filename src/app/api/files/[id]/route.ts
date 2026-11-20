import { auth } from "@/auth";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { verifySignature } from "@/server/signing";

export const runtime = "nodejs";

/** Streams a private file. Requires BOTH a valid short-lived signature and an authorised session. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const variant = url.searchParams.get("v") === "thumb" ? "thumb" : "full";
  const ok = verifySignature(id, variant, Number(url.searchParams.get("exp")), url.searchParams.get("sig") ?? "");
  if (!ok) return new Response("Link expired", { status: 403 });

  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const file = await db.caseFile.findUnique({ where: { id }, include: { case: { select: { status: true, authorId: true, deletedAt: true } } } });
  if (!file || file.case.deletedAt) return new Response("Not found", { status: 404 });

  const staff = session.user.role !== "MEMBER";
  const isAuthor = file.case.authorId === session.user.id;
  const visible = file.case.status === "PUBLISHED" ? file.selected : isAuthor || staff;
  if (!visible) return new Response("Not found", { status: 404 });
  if (file.scanStatus === "INFECTED") return new Response("Blocked", { status: 403 });

  const key = variant === "thumb" ? file.thumbKey : file.storageKey;
  if (!key) return new Response("Not found", { status: 404 });
  let data: Buffer;
  try {
    data = await storage.get(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": variant === "thumb" ? "image/jpeg" : file.mimeType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
