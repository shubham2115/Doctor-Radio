import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Brain, EyeOff, Layers, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const features = [
  { icon: EyeOff, title: "Independent-first reads", text: "Submit your own observation before revealing the community's — a built-in guard against anchoring bias." },
  { icon: Layers, title: "Structured observations", text: "Findings, impression, differentials and confidence — every contribution keeps its author and timestamp." },
  { icon: Brain, title: "AI study companion", text: "An educational assistant that explains signs and differentials. It never diagnoses and never posts for you." },
  { icon: ShieldCheck, title: "Privacy before publishing", text: "DICOM metadata scrubbing, uploader attestation and moderator review gate every case." },
];

export default async function Landing() {
  if ((await auth())?.user) redirect("/home");
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/register">Join free</Link></Button>
        </div>
      </header>
      <main>
        <section className="relative mx-auto max-w-4xl px-6 pb-20 pt-20 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
          <p className="mx-auto mb-5 w-fit rounded-full border border-border bg-surface px-3.5 py-1 text-xs font-medium text-muted">For residents, fellows, consultants &amp; students</p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Learn radiology from <span className="text-accent">every case</span>, together.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Upload de-identified cases, write your own read, compare interpretations with peers and sharpen your pattern recognition beyond what your hospital sees.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Button asChild size="lg"><Link href="/register">Get started <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="/login">I have an account</Link></Button>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-subtle">
        Educational use only. Not a diagnostic or reporting system. Share de-identified cases only.
      </footer>
    </div>
  );
}
