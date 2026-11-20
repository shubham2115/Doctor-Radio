import Link from "next/link";
import { Heart, MessageCircle, ScanEye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TimeAgo } from "@/components/ui/time-ago";
import { Avatar } from "@/components/ui/avatar";
import { DIFFICULTY_LABEL, DIFFICULTY_TONE, MODALITY_LABEL } from "@/lib/labels";

import type { CaseCardView } from "@/server/services/dashboard";

/** Shows the signed thumbnail when one exists (images); DICOM/PDF cases get a modality tile. */
export function CaseCard({ c }: { c: CaseCardView }) {
  return (
    <Link
      href={`/cases/${c.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]"
    >
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-navy to-[#12395f]">
        {c.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <>
            <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,var(--accent),transparent_55%)]" />
            <span className="relative text-3xl font-semibold tracking-tight text-white/90">{MODALITY_LABEL[c.modality]}</span>
          </>
        )}
        <Badge tone={DIFFICULTY_TONE[c.difficulty]} className="absolute right-3 top-3 backdrop-blur">{DIFFICULTY_LABEL[c.difficulty]}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-accent">{MODALITY_LABEL[c.modality]} · {c.bodyRegion}</p>
        <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight group-hover:text-accent">{c.title}</h3>
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={c.authorName} src={c.authorAvatar} size={22} />
            <span className="truncate">{c.authorName}</span>
            {c.publishedAt && <span className="shrink-0 text-subtle">· <TimeAgo date={c.publishedAt} /></span>}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1" title="Observations"><ScanEye className="h-3.5 w-3.5" />{c.observationCount}</span>
            <span className="flex items-center gap-1" title="Comments"><MessageCircle className="h-3.5 w-3.5" />{c.commentCount}</span>
            <span className="flex items-center gap-1" title="Likes"><Heart className="h-3.5 w-3.5" />{c.likeCount}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
