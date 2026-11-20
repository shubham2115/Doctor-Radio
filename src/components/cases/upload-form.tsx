"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileArchive, FileImage, FileText, ScanLine, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { AGE_RANGES, BODY_REGIONS, CASE_CATEGORIES } from "@/lib/validation/case";
import { DIFFICULTY_LABEL, MODALITY_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const ACCEPT = ".jpg,.jpeg,.png,.pdf,.zip,.rar,.dcm";
const MAX_FILE = 150 * 1024 * 1024;

const fmt = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
const iconFor = (name: string) => (/\.(zip|rar)$/i.test(name) ? FileArchive : /\.pdf$/i.test(name) ? FileText : /\.dcm$/i.test(name) ? ScanLine : FileImage);

export function UploadForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE) toast.error(`${f.name} is larger than 150 MB`);
      else if (!/\.(jpe?g|png|pdf|zip|rar|dcm)$/i.test(f.name)) toast.error(`${f.name}: unsupported file type`);
      else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next.slice(0, 40));
  }

  function addTag() {
    const t = tagText.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "");
    if (t.length >= 2 && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagText("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    if (!files.length) return toast.error("Add at least one file");
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const meta = {
      title: text("title"), modality: text("modality"), bodyRegion: text("bodyRegion"), difficulty: text("difficulty"),
      category: text("category") || undefined, patientAgeRange: text("patientAgeRange") || undefined,
      clinicalHistory: text("clinicalHistory"), clinicalInfo: text("clinicalInfo"), imagingFindings: text("imagingFindings"),
      finalDiagnosis: text("finalDiagnosis"), tags,
    };
    const body = new FormData();
    body.set("meta", JSON.stringify(meta));
    files.forEach((file) => body.append("files", file));

    // XHR (not fetch) so we can show real upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cases");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status === 201) {
        data.warnings?.forEach((w: string) => toast.warning(w));
        toast.success("Files processed and de-identified. Review before submitting.");
        router.push(`/cases/${data.caseId}/review`);
        return;
      }
      setProgress(null);
      setErrors(data.fieldErrors ?? {});
      toast.error(data.error ?? "Upload failed");
    };
    xhr.onerror = () => { setProgress(null); toast.error("Network error during upload"); };
    setProgress(0);
    xhr.send(body);
  }

  const busy = progress !== null;
  const e = (k: string) => <FieldError message={errors[k]?.[0]} />;

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_380px]" noValidate>
      <div className="space-y-6">
        <Card className="space-y-5 p-6">
          <h2 className="font-semibold tracking-tight">Case details</h2>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" maxLength={160} placeholder="e.g. Ring-enhancing lesion in a 45-year-old with headache" aria-invalid={!!errors.title} />
            {e("title")}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="modality">Modality</Label><Select id="modality" name="modality" defaultValue="CT">{Object.entries(MODALITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
            <div><Label htmlFor="bodyRegion">Body region</Label><Select id="bodyRegion" name="bodyRegion" defaultValue="Brain">{BODY_REGIONS.map((r) => <option key={r}>{r}</option>)}</Select></div>
            <div><Label htmlFor="difficulty">Difficulty</Label><Select id="difficulty" name="difficulty" defaultValue="INTERMEDIATE">{Object.entries(DIFFICULTY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
            <div><Label htmlFor="category">Category</Label><Select id="category" name="category" defaultValue=""><option value="">—</option>{CASE_CATEGORIES.map((r) => <option key={r}>{r}</option>)}</Select></div>
            <div><Label htmlFor="patientAgeRange">Patient age range</Label><Select id="patientAgeRange" name="patientAgeRange" defaultValue=""><option value="">—</option>{AGE_RANGES.map((r) => <option key={r}>{r}</option>)}</Select></div>
          </div>
          <div>
            <Label htmlFor="clinicalHistory">Clinical history</Label>
            <Textarea id="clinicalHistory" name="clinicalHistory" maxLength={4000} placeholder="Presenting complaint, relevant history. No names, dates of birth, IDs or contact details." aria-invalid={!!errors.clinicalHistory} />
            {e("clinicalHistory")}
          </div>
          <div><Label htmlFor="clinicalInfo">Relevant clinical information <span className="font-normal text-subtle">(optional)</span></Label><Textarea id="clinicalInfo" name="clinicalInfo" maxLength={4000} className="min-h-20" placeholder="Labs, prior imaging, examination findings…" /></div>
          <div><Label htmlFor="imagingFindings">Imaging findings <span className="font-normal text-subtle">(optional — shown to everyone, so avoid giving away the answer)</span></Label><Textarea id="imagingFindings" name="imagingFindings" maxLength={4000} className="min-h-20" /></div>
          <div><Label htmlFor="finalDiagnosis">Final diagnosis <span className="font-normal text-subtle">(optional, private to you for now)</span></Label><Input id="finalDiagnosis" name="finalDiagnosis" maxLength={300} /></div>
          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex flex-wrap gap-1.5 rounded-[10px] border border-border bg-surface p-2 focus-within:border-accent focus-within:ring-4 focus-within:ring-[var(--ring)]">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  {t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input id="tags" value={tagText} onChange={(ev) => setTagText(ev.target.value)} onBlur={addTag}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === ",") { ev.preventDefault(); addTag(); } }}
                placeholder={tags.length ? "" : "Type a tag and press Enter"} className="min-w-32 flex-1 bg-transparent px-1.5 text-sm outline-none" />
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="font-semibold tracking-tight">Images &amp; files</h2>
          <p className="mt-1 text-xs text-muted">JPG, PNG, PDF, DICOM (.dcm), ZIP or RAR · up to 150 MB per file</p>
          <div
            onDragOver={(ev) => { ev.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(ev) => { ev.preventDefault(); setDrag(false); addFiles(ev.dataTransfer.files); }}
            onClick={() => input.current?.click()} role="button" tabIndex={0}
            onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && input.current?.click()}
            className={cn("mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong hover:bg-surface-2")}
          >
            <UploadCloud className="h-8 w-8 text-accent" />
            <p className="mt-2 text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-0.5 text-xs text-muted">Archives are extracted securely on the server</p>
            <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(ev) => { if (ev.target.files) addFiles(ev.target.files); ev.target.value = ""; }} />
          </div>
          {files.length > 0 && (
            <ul className="mt-4 max-h-64 space-y-1.5 overflow-auto">
              {files.map((f) => {
                const Icon = iconFor(f.name);
                return (
                  <li key={f.name + f.size} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-subtle">{fmt(f.size)}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => setFiles(files.filter((x) => x !== f))} className="text-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed">
            Files are de-identified automatically (DICOM tags and image metadata), but <strong>burned-in text</strong> in pixels can&apos;t be removed automatically. You&apos;ll review and confirm on the next step.
          </div>
          {progress !== null && (
            <div className="mt-4" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1.5 text-xs text-muted">{progress < 100 ? `Uploading… ${progress}%` : "Scanning, extracting and de-identifying…"}</p>
            </div>
          )}
          <Button type="submit" className="mt-5 w-full" loading={busy}>Upload &amp; continue</Button>
        </Card>
      </div>
    </form>
  );
}
