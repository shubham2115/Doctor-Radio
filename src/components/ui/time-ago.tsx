import { timeAgo } from "@/lib/utils";

/** Relative time that tolerates the server/client clock difference (no hydration mismatch). */
export function TimeAgo({ date }: { date: Date | string }) {
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString("en-IN")} suppressHydrationWarning>
      {timeAgo(d)}
    </time>
  );
}
