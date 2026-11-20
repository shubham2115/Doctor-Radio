"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { DESIGNATIONS, INTEREST_OPTIONS } from "@/lib/validation/profile";
import { cn } from "@/lib/utils";

export type ProfileFormValues = {
  username: string;
  displayName: string;
  designation: string;
  qualification: string;
  institutionName: string;
  institutionCity: string;
  yearsExperience: string;
  bio: string;
  interests: string[];
};

export function ProfileForm({ initial, mode }: { initial: ProfileFormValues; mode: "onboarding" | "edit" }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const set = <K extends keyof ProfileFormValues>(k: K, val: ProfileFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const toggleInterest = (i: string) =>
    set("interests", v.interests.includes(i) ? v.interests.filter((x) => x !== i) : v.interests.length < 8 ? [...v.interests, i] : v.interests);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await api<{ username: string }>("/api/profile", "PUT", {
        ...v,
        yearsExperience: v.yearsExperience === "" ? undefined : v.yearsExperience,
      });
      toast.success(mode === "onboarding" ? "Profile saved — welcome aboard" : "Profile updated");
      router.replace(mode === "onboarding" ? "/home" : `/u/${res.username}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors ?? {});
        toast.error(err.fieldErrors ? "Please fix the highlighted fields" : err.message);
      } else toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="displayName">Full name</Label>
          <Input id="displayName" value={v.displayName} onChange={(e) => set("displayName", e.target.value)} aria-invalid={!!errors.displayName} />
          <FieldError message={errors.displayName?.[0]} />
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={v.username} onChange={(e) => set("username", e.target.value.toLowerCase())} aria-invalid={!!errors.username} placeholder="dr_mehta" />
          <FieldError message={errors.username?.[0]} />
        </div>
        <div>
          <Label htmlFor="designation">Designation</Label>
          <Select id="designation" value={v.designation} onChange={(e) => set("designation", e.target.value)}>
            {DESIGNATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="qualification">Qualification</Label>
          <Input id="qualification" value={v.qualification} onChange={(e) => set("qualification", e.target.value)} placeholder="MD Radiodiagnosis" />
        </div>
        <div>
          <Label htmlFor="institutionName">Institution / hospital</Label>
          <Input id="institutionName" value={v.institutionName} onChange={(e) => set("institutionName", e.target.value)} placeholder="AIIMS" />
        </div>
        <div>
          <Label htmlFor="institutionCity">City</Label>
          <Input id="institutionCity" value={v.institutionCity} onChange={(e) => set("institutionCity", e.target.value)} placeholder="New Delhi" />
        </div>
        <div>
          <Label htmlFor="yearsExperience">Years of experience</Label>
          <Input id="yearsExperience" type="number" min={0} max={60} value={v.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} />
          <FieldError message={errors.yearsExperience?.[0]} />
        </div>
      </div>

      <div>
        <Label>Areas of interest <span className="font-normal text-subtle">(up to 8)</span></Label>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((i) => {
            const on = v.interests.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() => toggleInterest(i)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" value={v.bio} maxLength={600} onChange={(e) => set("bio", e.target.value)} placeholder="Tell the community about your training and interests." />
        <p className="mt-1 text-right text-xs text-subtle">{v.bio.length}/600</p>
      </div>

      <div className="flex justify-end gap-3">
        {mode === "edit" && <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>}
        <Button type="submit" loading={loading}>{mode === "onboarding" ? "Finish setup" : "Save changes"}</Button>
      </div>
    </form>
  );
}
