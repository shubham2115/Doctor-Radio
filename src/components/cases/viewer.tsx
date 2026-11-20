"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2, Minimize2, Move, RotateCcw, SunMedium, ZoomIn, ZoomOut, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewerItem = {
  id: string; kind: "IMAGE" | "PDF" | "DICOM"; name: string; url: string; thumbUrl: string | null; frames: number;
  meta: Record<string, string | number | null> | null;
};

type Parsed = import("dicom-parser").DataSet;
type Slide = { item: ViewerItem; frame: number };

const PRESETS: [string, number, number][] = [["Brain", 40, 80], ["Soft tissue", 40, 400], ["Lung", -600, 1500], ["Bone", 400, 1800]];
const UNSUPPORTED_TS = (ts: unknown) => typeof ts === "string" && ts !== "" && !["1.2.840.10008.1.2", "1.2.840.10008.1.2.1"].includes(ts);

/** Decode one DICOM frame to RGBA applying rescale + window/level. Uncompressed little-endian only. */
function drawFrame(canvas: HTMLCanvasElement, ds: Parsed, frame: number, wc: number, ww: number) {
  const rows = ds.uint16("x00280010")!, cols = ds.uint16("x00280011")!;
  const bits = ds.uint16("x00280100") ?? 16, signed = (ds.uint16("x00280103") ?? 0) === 1, samples = ds.uint16("x00280002") ?? 1;
  const slope = ds.floatString("x00281053") ?? 1, intercept = ds.floatString("x00281052") ?? 0;
  const mono1 = (ds.string("x00280004") ?? "").trim() === "MONOCHROME1";
  const el = ds.elements.x7fe00010;
  if (!el) throw new Error("No pixel data");
  const bpp = bits / 8, frameBytes = rows * cols * samples * bpp;
  const start = el.dataOffset + frame * frameBytes;
  const raw = ds.byteArray.slice(start, start + frameBytes); // copy => aligned buffer
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(cols, rows);
  const out = img.data, n = rows * cols;
  if (samples === 3 && bits === 8) {
    const planar = (ds.uint16("x00280006") ?? 0) === 1;
    for (let i = 0; i < n; i++) {
      out[i * 4] = raw[planar ? i : i * 3]; out[i * 4 + 1] = raw[planar ? n + i : i * 3 + 1];
      out[i * 4 + 2] = raw[planar ? 2 * n + i : i * 3 + 2]; out[i * 4 + 3] = 255;
    }
  } else {
    const px = bits === 8 ? new Uint8Array(raw.buffer) : signed ? new Int16Array(raw.buffer) : new Uint16Array(raw.buffer);
    const low = wc - ww / 2, scale = 255 / Math.max(ww, 1);
    for (let i = 0; i < n; i++) {
      let v = Math.round((px[i] * slope + intercept - low) * scale);
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      if (mono1) v = 255 - v;
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function autoWindow(ds: Parsed) {
  const wc = ds.floatString("x00281050"), ww = ds.floatString("x00281051");
  if (wc !== undefined && ww) return { wc, ww };
  const rows = ds.uint16("x00280010")!, cols = ds.uint16("x00280011")!, bits = ds.uint16("x00280100") ?? 16;
  const signed = (ds.uint16("x00280103") ?? 0) === 1, el = ds.elements.x7fe00010;
  if (!el) return { wc: 128, ww: 256 };
  const raw = ds.byteArray.slice(el.dataOffset, el.dataOffset + rows * cols * (bits / 8));
  const px = bits === 8 ? new Uint8Array(raw.buffer) : signed ? new Int16Array(raw.buffer) : new Uint16Array(raw.buffer);
  const slope = ds.floatString("x00281053") ?? 1, ic = ds.floatString("x00281052") ?? 0;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < px.length; i += 7) { const v = px[i] * slope + ic; if (v < min) min = v; if (v > max) max = v; }
  return { wc: (min + max) / 2, ww: Math.max(max - min, 1) };
}

export function Viewer({ items }: { items: ViewerItem[] }) {
  const visual = useMemo(() => items.filter((i) => i.kind !== "PDF"), [items]);
  const pdfs = items.filter((i) => i.kind === "PDF");
  const slides = useMemo<Slide[]>(() => visual.flatMap((item) => Array.from({ length: item.kind === "DICOM" ? Math.max(1, item.frames) : 1 }, (_, frame) => ({ item, frame }))), [visual]);

  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"pan" | "wl">("pan");
  const [expanded, setExpanded] = useState(false);
  const [wlOverride, setWl] = useState<{ wc: number; ww: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<Record<string, Parsed>>({});
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; pan: { x: number; y: number }; wl: { wc: number; ww: number } | null } | null>(null);

  const slide = slides[idx];
  const isDicom = slide?.item.kind === "DICOM";
  const dicomItems = useMemo(() => visual.filter((v) => v.kind === "DICOM"), [visual]);

  // Load DICOM files (concurrency 4); parsed lazily so non-DICOM cases never ship the parser.
  useEffect(() => {
    if (!dicomItems.length) return;
    let cancelled = false;
    (async () => {
      const dp = (await import("dicom-parser")).default;
      let next = 0;
      const worker = async () => {
        while (!cancelled && next < dicomItems.length) {
          const it = dicomItems[next++];
          try {
            const res = await fetch(it.url);
            if (!res.ok) throw new Error(res.status === 403 ? "This link has expired — refresh the page." : "Could not load a DICOM file");
            const ds = dp.parseDicom(new Uint8Array(await res.arrayBuffer()));
            if (UNSUPPORTED_TS(ds.string("x00020010"))) throw new Error("This DICOM uses a compressed transfer syntax that the in-browser viewer can't render yet.");
            if (!cancelled) setDatasets((prev) => ({ ...prev, [it.id]: ds }));
          } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load DICOM"); }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    })();
    return () => { cancelled = true; };
  }, [dicomItems]);

  const ds = isDicom ? datasets[slide.item.id] : undefined;
  const loaded = Object.keys(datasets).length;

  // Default window/level comes from the file itself; the user's manual adjustment overrides it.
  const autoWl = useMemo(() => (ds ? autoWindow(ds) : null), [ds]);
  const wl = wlOverride ?? autoWl;

  useEffect(() => {
    if (!isDicom || !ds || !wl || !canvasRef.current) return;
    try { drawFrame(canvasRef.current, ds, slide.frame, wl.wc, wl.ww); } catch (e) { console.error("[viewer] render failed", e); }
  }, [isDicom, ds, wl, slide]);

  const go = useCallback((d: number) => setIdx((i) => Math.min(slides.length - 1, Math.max(0, i + d))), [slides.length]);
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); setWl(null); };
  const zoomBy = useCallback((f: number) => setZoom((z) => Math.min(12, Math.max(0.25, z * f))), []);

  const isDicomRef = useRef(false);
  const slidesLen = useRef(0);
  useEffect(() => { isDicomRef.current = isDicom; slidesLen.current = slides.length; });

  // Wheel needs a non-passive listener so we can prevent page scroll: scroll slices, Ctrl/⌘ zooms.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || !isDicomRef.current || slidesLen.current < 2) zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      else go(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [go, zoomBy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, zoomBy]);

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pan, wl };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (tool === "wl" && isDicom && d.wl) setWl({ wc: d.wl.wc + dy * (d.wl.ww / 400), ww: Math.max(1, d.wl.ww + dx * (d.wl.ww / 400)) });
    else setPan({ x: d.pan.x + dx, y: d.pan.y + dy });
  }

  if (!slides.length && !pdfs.length) return <div className="flex h-full min-h-80 items-center justify-center rounded-2xl bg-navy text-sm text-white/60">No viewable images in this case.</div>;

  const ctl = "h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white";
  return (
    <div className={cn("flex flex-col overflow-hidden bg-[#050b16] text-white", expanded ? "fixed inset-0 z-50" : "h-full min-h-[420px] rounded-2xl border border-border shadow-[var(--shadow-md)]")}>
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-2">
        <Button variant="ghost" size="icon" className={ctl} onClick={() => zoomBy(1.25)} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={ctl} onClick={() => zoomBy(0.8)} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={ctl} onClick={resetView} aria-label="Reset view"><RotateCcw className="h-4 w-4" /></Button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <Button variant="ghost" size="icon" className={cn(ctl, tool === "pan" && "bg-white/15 text-white")} onClick={() => setTool("pan")} aria-label="Pan tool" aria-pressed={tool === "pan"}><Move className="h-4 w-4" /></Button>
        {isDicom && <Button variant="ghost" size="icon" className={cn(ctl, tool === "wl" && "bg-white/15 text-white")} onClick={() => setTool("wl")} aria-label="Window/level tool" aria-pressed={tool === "wl"}><Contrast className="h-4 w-4" /></Button>}
        <span className="ml-2 text-xs tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
        <div className="ml-auto flex items-center gap-1">
          {slides.length > 1 && <span className="mr-1 text-xs tabular-nums text-white/70">{idx + 1} / {slides.length}</span>}
          <Button variant="ghost" size="icon" className={ctl} onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous image"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className={ctl} onClick={() => go(1)} disabled={idx >= slides.length - 1} aria-label="Next image"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className={ctl} onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Exit full screen" : "Expand viewer"}>{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
        </div>
      </div>

      {isDicom && wl && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-3 py-1.5 text-xs text-white/60">
          <SunMedium className="h-3.5 w-3.5" />W {Math.round(wl.ww)} · L {Math.round(wl.wc)}
          <span className="ml-2 flex gap-1">{PRESETS.map(([n, c, w]) => <button key={n} onClick={() => setWl({ wc: c, ww: w })} className="rounded-md px-2 py-0.5 hover:bg-white/10 hover:text-white">{n}</button>)}</span>
        </div>
      )}

      <div ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; setDragging(false); }} onDoubleClick={resetView}
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden"
        style={{ cursor: tool === "wl" ? "crosshair" : dragging ? "grabbing" : "grab" }}>
        {slide?.item.kind === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.item.url} alt={slide.item.name} draggable={false} className="max-h-full max-w-full object-contain" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }} />
        )}
        {isDicom && (
          <canvas ref={canvasRef} className="max-h-full max-w-full" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, imageRendering: zoom > 2 ? "pixelated" : "auto" }} />
        )}
        {isDicom && !ds && !error && <p className="absolute text-sm text-white/60">Loading DICOM… {loaded}/{dicomItems.length}</p>}
        {error && <p className="absolute inset-x-6 bottom-4 rounded-lg bg-danger/20 px-3 py-2 text-center text-xs text-red-200">{error}</p>}
        {isDicom && slide.item.meta && (
          <div className="pointer-events-none absolute left-3 top-3 text-[11px] leading-4 text-white/55">
            {slide.item.meta.modality} {slide.item.meta.seriesDescription ? `· ${slide.item.meta.seriesDescription}` : ""}
            <br />Image {idx + 1}/{slides.length}{slide.item.meta.sliceThickness ? ` · ${slide.item.meta.sliceThickness} mm` : ""}
          </div>
        )}
      </div>

      {isDicom && slides.length > 1 && (
        <input type="range" min={0} max={slides.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} aria-label="Slice" className="mx-3 my-2 accent-[var(--accent)]" />
      )}
      {!isDicom && slides.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-2">
          {slides.map((s, i) => (
            <button key={s.item.id + s.frame} onClick={() => { setIdx(i); setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label={`Image ${i + 1}`}
              className={cn("h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-navy transition-opacity", i === idx ? "border-accent" : "border-transparent opacity-60 hover:opacity-100")}>
              {s.item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.item.thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : <span className="text-[10px]">{i + 1}</span>}
            </button>
          ))}
        </div>
      )}
      {pdfs.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 p-2">
          {pdfs.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">
              <FileText className="h-3.5 w-3.5" />{p.name}<ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
