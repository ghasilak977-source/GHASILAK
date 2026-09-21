"use client";

import { MessageCircle } from "lucide-react";
import type { Dictionary } from "@/messages/en";
import { buildWhatsAppUrl } from "@/lib/whatsapp/link";

export function WhatsAppFab({
  phone,
  message,
  label,
}: {
  phone: string;
  message: string;
  label: string;
}) {
  const href = buildWhatsAppUrl(phone, message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed bottom-20 end-4 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[rgba(37,99,168,0.25)] transition hover:scale-105 active:scale-95 md:bottom-8"
    >
      <MessageCircle className="size-7" fill="currentColor" />
    </a>
  );
}

export function WhatsAppFabFromDict({
  phone,
  dict,
  orderNumber,
}: {
  phone: string;
  dict: Dictionary;
  orderNumber?: string;
}) {
  const message = orderNumber
    ? dict.whatsapp.supportOrder.replace("{orderNumber}", orderNumber)
    : dict.whatsapp.supportGeneric;

  return (
    <WhatsAppFab phone={phone} message={message} label={dict.common.whatsapp} />
  );
}
