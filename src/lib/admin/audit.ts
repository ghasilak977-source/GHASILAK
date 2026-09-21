"use server";

import { createClient } from "@/lib/supabase/server";

export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    before_data: params.before ?? null,
    after_data: params.after ?? null,
  });
}
