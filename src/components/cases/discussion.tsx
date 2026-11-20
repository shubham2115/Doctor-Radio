"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/ui/time-ago";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Markdown, MarkdownEditor } from "@/components/ui/markdown";
import { ReportButton } from "./case-actions";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CommentView } from "@/server/services/case-detail";

function Composer({ caseId, parentId, observationId, onDone, placeholder, autoFocus }: { caseId: string; parentId?: string; observationId?: string; onDone?: () => void; placeholder?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function post() {
    if (!body.trim()) return;
    setBusy(true);
    try { await api(`/api/cases/${caseId}/comments`, "POST", { body, parentId, observationId }); setBody(""); onDone?.(); router.refresh(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not post"); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <MarkdownEditor value={body} onChange={setBody} placeholder={placeholder ?? "Add to the discussion…"} maxLength={4000} autoFocus={autoFocus} />
      <div className="flex justify-end gap-2">
        {onDone && <Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>}
        <Button size="sm" onClick={post} loading={busy} disabled={!body.trim()}>{parentId ? "Reply" : "Post"}</Button>
      </div>
    </div>
  );
}

function Item({ c, all, caseId, depth, isStaff }: { c: CommentView; all: CommentView[]; caseId: string; depth: number; isStaff: boolean }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [like, setLike] = useState({ on: c.likedByMe, n: c.likeCount });
  const children = all.filter((x) => x.parentId === c.id);

  async function toggleLike() {
    const was = like.on;
    setLike({ on: !was, n: like.n + (was ? -1 : 1) });
    try { await api(`/api/comments/${c.id}/like`, was ? "DELETE" : "POST"); } catch { setLike({ on: was, n: like.n }); toast.error("Something went wrong"); }
  }
  async function save() {
    try { await api(`/api/comments/${c.id}`, "PATCH", { body: text }); setEditing(false); router.refresh(); }
    catch { toast.error("Could not save"); }
  }
  async function remove() {
    if (!confirm("Delete this comment?")) return;
    try { await api(`/api/comments/${c.id}`, "DELETE"); router.refresh(); } catch { toast.error("Could not delete"); }
  }

  return (
    <div className={cn(depth > 0 && "ml-5 border-l border-border pl-4")}>
      <div className="flex gap-3 py-2.5">
        <Avatar name={c.authorName} src={c.authorAvatar} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {c.authorUsername ? <Link href={`/u/${c.authorUsername}`} className="font-medium hover:text-accent">{c.authorName}</Link> : <span className="font-medium">{c.authorName}</span>}
            <span className="ml-2 text-xs text-subtle"><TimeAgo date={c.createdAt} />{c.editedAt ? " · edited" : ""}</span>
          </p>
          {editing ? (
            <div className="mt-1.5 space-y-2"><MarkdownEditor value={text} onChange={setText} maxLength={4000} /><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" onClick={save}>Save</Button></div></div>
          ) : <Markdown>{c.body}</Markdown>}
          {!editing && (
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              <button onClick={toggleLike} aria-pressed={like.on} className="flex items-center gap-1 hover:text-danger"><Heart className={cn("h-3.5 w-3.5", like.on && "fill-danger text-danger")} />{like.n || ""}</button>
              {depth < 3 && <button onClick={() => setReplying((v) => !v)} className="flex items-center gap-1 hover:text-accent"><MessageCircle className="h-3.5 w-3.5" />Reply</button>}
              {c.mine && <button onClick={() => setEditing(true)} className="hover:text-fg">Edit</button>}
              {(c.mine || isStaff) && <button onClick={remove} className="hover:text-danger">Delete</button>}
              {!c.mine && <ReportButton targetType="COMMENT" targetId={c.id} compact />}
            </div>
          )}
          {replying && <div className="mt-2"><Composer caseId={caseId} parentId={c.id} autoFocus placeholder={`Reply to ${c.authorName}…`} onDone={() => setReplying(false)} /></div>}
        </div>
      </div>
      {children.map((k) => <Item key={k.id} c={k} all={all} caseId={caseId} depth={depth + 1} isStaff={isStaff} />)}
    </div>
  );
}

/** Threaded comments. `observationId` scopes the thread to one observation; omit for the case-level discussion. */
export function CommentThread({ caseId, comments, observationId, isStaff, compact }: { caseId: string; comments: CommentView[]; observationId?: string; isStaff: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const scoped = comments.filter((c) => (c.observationId ?? undefined) === observationId);
  const roots = scoped.filter((c) => !c.parentId);

  if (compact)
    return (
      <div className="mt-3 border-t border-border pt-2">
        {roots.map((c) => <Item key={c.id} c={c} all={scoped} caseId={caseId} depth={0} isStaff={isStaff} />)}
        {open ? <div className="mt-2"><Composer caseId={caseId} observationId={observationId} autoFocus placeholder="Reply to this observation…" onDone={() => setOpen(false)} /></div>
          : <button onClick={() => setOpen(true)} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted hover:text-accent"><MessageCircle className="h-3.5 w-3.5" />{roots.length ? "Add reply" : "Reply to this observation"}</button>}
      </div>
    );

  return (
    <div className="space-y-4">
      <Composer caseId={caseId} />
      {roots.length === 0 ? <p className="py-6 text-center text-sm text-muted">No comments yet. Start the conversation.</p> : <div className="divide-y divide-border">{roots.map((c) => <Item key={c.id} c={c} all={scoped} caseId={caseId} depth={0} isStaff={isStaff} />)}</div>}
    </div>
  );
}
