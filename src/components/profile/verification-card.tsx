"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

type Status = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export function VerificationCard({ status }: { status: Status }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/profile/verification", "POST", { registrationNo: String(f.get("registrationNo")), council: String(f.get("council")) });
      toast.success("Submitted for review");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors ?? {});
        if (!err.fieldErrors) toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6" id="verification">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Professional verification</h2>
          <p className="mt-1 text-sm text-muted">Verified doctors can upload cases. A moderator checks your medical council registration.</p>
        </div>
        {status === "VERIFIED" && <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" />Verified</Badge>}
        {status === "PENDING" && <Badge tone="warning"><Clock className="h-3.5 w-3.5" />Under review</Badge>}
        {status === "REJECTED" && <Badge tone="danger"><ShieldAlert className="h-3.5 w-3.5" />Not approved</Badge>}
      </div>
      {(status === "UNVERIFIED" || status === "REJECTED") && (
        <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <Label htmlFor="registrationNo">Registration number</Label>
            <Input id="registrationNo" name="registrationNo" aria-invalid={!!errors.registrationNo} />
            <FieldError message={errors.registrationNo?.[0]} />
          </div>
          <div>
            <Label htmlFor="council">Medical council</Label>
            <Input id="council" name="council" placeholder="e.g. National Medical Commission" aria-invalid={!!errors.council} />
            <FieldError message={errors.council?.[0]} />
          </div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={loading}>Submit for verification</Button></div>
        </form>
      )}
    </Card>
  );
}
