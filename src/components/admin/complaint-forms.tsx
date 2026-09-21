"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  adminCreateComplaint,
  adminUpdateComplaint,
} from "@/lib/admin/actions";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ComplaintCreateForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [complaint_type, setType] = useState("other");

  return (
    <form
      className="mb-6 space-y-2 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminCreateComplaint({
            subject,
            description,
            complaint_type,
          });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            setSubject("");
            setDescription("");
            router.refresh();
          }
        });
      }}
    >
      <select
        className="h-9 w-full rounded-lg border px-2 text-sm"
        value={complaint_type}
        onChange={(e) => setType(e.target.value)}
      >
        {Object.entries(dict.admin.complaintTypes).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Input
        placeholder={dict.admin.name}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <Button type="submit" disabled={pending}>
        {dict.common.add}
      </Button>
    </form>
  );
}

export function ComplaintStatusForm({
  dict,
  id,
  status,
}: {
  dict: Dictionary;
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [next, setNext] = useState(
    status === "in_progress" ? "investigating" : status,
  );
  const [notes, setNotes] = useState("");
  const [comp, setComp] = useState("");

  return (
    <form
      className="mt-2 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminUpdateComplaint({
            id,
            status: next,
            resolution_notes: notes || undefined,
            compensation_omr: comp || undefined,
          });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            router.refresh();
          }
        });
      }}
    >
      <select
        className="h-9 rounded-lg border px-2 text-sm"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      >
        {Object.entries(dict.admin.complaintStatuses)
          .filter(([k]) => k !== "in_progress")
          .map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
      </select>
      <Input
        placeholder={dict.admin.resolution}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="min-w-[160px] flex-1"
      />
      <Input
        placeholder={dict.admin.compensation}
        value={comp}
        onChange={(e) => setComp(e.target.value)}
        className="w-28 font-mono"
        dir="ltr"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {dict.admin.save}
      </Button>
    </form>
  );
}
