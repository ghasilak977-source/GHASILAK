import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { isValidQrTokenFormat } from "@/lib/orders/qr";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/**
 * QR landing — opaque token only (no phone/address/financials in the URL).
 * Resolves via security-definer RPC for authorized customer / driver / staff.
 */
export default async function QrResolvePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: raw, token } = await params;
  if (!isLocale(raw) || !isValidQrTokenFormat(token)) notFound();

  if (!hasSupabaseEnv()) {
    notFound();
  }

  const session = await getSessionUser();
  if (!session) {
    redirect(`/${raw}/login?next=/${raw}/qr/${token}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_order_qr", {
    p_token: token,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    notFound();
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    order_id: string;
    viewer: string;
  };

  if (!row?.order_id) notFound();

  if (row.viewer === "driver") {
    redirect(`/${raw}/driver/jobs/${row.order_id}`);
  }
  if (row.viewer === "staff") {
    redirect(`/${raw}/admin/orders/${row.order_id}`);
  }
  redirect(`/${raw}/orders/${row.order_id}`);
}
