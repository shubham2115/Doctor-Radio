import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScanLine, ShieldCheck, Users } from "lucide-react";

const points = [
  { icon: ScanLine, title: "Independent reads first", text: "Write your own observation before seeing anyone else's — reduce anchoring bias." },
  { icon: Users, title: "A community of radiologists", text: "Residents, fellows and consultants learning from every case." },
  { icon: ShieldCheck, title: "De-identified by design", text: "Mandatory privacy checks and moderation before any case goes live." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-[#1b5fa8]/30 blur-3xl" />
        <Logo light />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Every scan is a<br />chance to learn <span className="text-accent">together.</span>
          </h1>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-accent" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-white/65">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/45">For educational use. Not a diagnostic or reporting system.</p>
      </aside>
      <main className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><Logo /></div>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
