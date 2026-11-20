"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

const PROVIDERS = [
  ["cohere", "Cohere", "command-a-03-2025"],
  ["anthropic", "Anthropic (Claude)", "claude-sonnet-5-5"],
  ["openai", "OpenAI", "gpt-4o-mini"],
  ["gemini", "Google Gemini", "gemini-2.0-flash"],
  ["openai-compatible", "OpenAI-compatible endpoint", "your-model-name"],
] as const;

type Initial = { provider: string; model: string; baseUrl: string; source: "ui" | "env" | "none"; keyHint: string | null };

export function LlmSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState({ provider: initial.provider, model: initial.model, baseUrl: initial.baseUrl, apiKey: "" });
  const [hint, setHint] = useState(initial.keyHint);
  const [source, setSource] = useState(initial.source);
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const def = PROVIDERS.find((p) => p[0] === v.provider)?.[2] ?? "";

  async function save(extra: { clearKey?: boolean } = {}) {
    setBusy(extra.clearKey ? "clear" : "save");
    setErrors({});
    setTest(null);
    try {
      const r = await api<Initial>("/api/admin/settings/llm", "PUT", { provider: v.provider, model: v.model, baseUrl: v.baseUrl, apiKey: v.apiKey, ...extra });
      setHint(r.keyHint);
      setSource(r.source);
      setV((p) => ({ ...p, apiKey: "" }));
      toast.success(extra.clearKey ? "API key removed" : "AI settings saved");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors ?? {});
        toast.error(e.message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    setBusy("test");
    setTest(null);
    try {
      const r = await api<{ provider: string; model: string; reply: string }>("/api/admin/settings/llm/test", "POST");
      setTest({ ok: true, text: `Connected to ${r.provider} (${r.model}). It replied “${r.reply}”.` });
    } catch (e) {
      setTest({ ok: false, text: e instanceof ApiError ? e.message : "Test failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold tracking-tight">Provider &amp; API key</h2>
        {hint ? (
          <Badge tone="success"><KeyRound className="h-3 w-3" />Key saved {hint} · from {source === "ui" ? "this page" : "environment"}</Badge>
        ) : (
          <Badge tone="warning">No API key configured</Badge>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="provider">Provider</Label>
          <Select id="provider" value={v.provider} onChange={(e) => setV({ ...v, provider: e.target.value })}>
            {PROVIDERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="model">Model <span className="font-normal text-subtle">(blank = {def})</span></Label>
          <Input id="model" value={v.model} placeholder={def} onChange={(e) => setV({ ...v, model: e.target.value })} />
          <FieldError message={errors.model?.[0]} />
        </div>
      </div>
      {v.provider === "openai-compatible" && (
        <div>
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input id="baseUrl" value={v.baseUrl} placeholder="https://api.example.com/v1" onChange={(e) => setV({ ...v, baseUrl: e.target.value })} />
          <FieldError message={errors.baseUrl?.[0]} />
        </div>
      )}
      <div>
        <Label htmlFor="apiKey">API key</Label>
        <Input id="apiKey" type="password" autoComplete="off" value={v.apiKey} onChange={(e) => setV({ ...v, apiKey: e.target.value })}
          placeholder={hint ? "Leave blank to keep the saved key" : "Paste your provider API key"} />
        <p className="mt-1.5 text-xs text-subtle">Stored encrypted (AES-256-GCM) and never shown again. Only de-identified case text is ever sent to the provider.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => save()} loading={busy === "save"} disabled={busy !== null}>Save settings</Button>
        <Button variant="secondary" onClick={runTest} disabled={busy !== null || !hint}>
          {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}Test connection
        </Button>
        {hint && source === "ui" && (
          <Button variant="ghost" className="ml-auto text-danger hover:bg-danger/10" disabled={busy !== null}
            onClick={() => confirm("Remove the saved API key? AI features will stop working.") && save({ clearKey: true })}>
            <Trash2 className="h-4 w-4" />Remove key
          </Button>
        )}
      </div>
      {test && (
        <p role="status" className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${test.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {test.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{test.text}
        </p>
      )}
    </Card>
  );
}
