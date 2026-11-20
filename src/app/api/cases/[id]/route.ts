import { NextResponse } from "next/server";
import { apiUser } from "@/server/dal";
import { assertSameOrigin, route } from "@/server/http";
import { deleteDraft } from "@/server/services/cases";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertSameOrigin(req);
    const user = await apiUser();
    await deleteDraft(user.id, (await ctx.params).id);
    return NextResponse.json({ ok: true });
  })(req);
}
