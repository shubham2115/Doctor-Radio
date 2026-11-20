import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { requireRole } from "@/server/dal";
import { getLlmConfigPublic } from "@/server/settings";
import { LlmSettingsForm } from "@/components/admin/llm-settings-form";

export const metadata: Metadata = { title: "AI settings" };

export default async function AiSettingsPage() {
  await requireRole("ADMIN");
  const cfg = await getLlmConfigPublic();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Moderation</Link>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Bot className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI assistant settings</h1>
          <p className="text-sm text-muted">Choose the LLM provider that powers the case assistant and Learning study sets.</p>
        </div>
      </div>
      <LlmSettingsForm initial={cfg} />
    </div>
  );
}
