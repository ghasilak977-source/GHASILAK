"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { SERVICE_ZONE_SEEDS } from "@/lib/settings/business-settings";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import type { Address, Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LinkButton } from "@/components/ui/link-button";

type ZoneOption = { code: string; name_en: string; name_ar: string };

export function ProfileClient({
  locale,
  dict,
  initialProfile,
  initialAddresses,
  zones,
}: {
  locale: Locale;
  dict: Dictionary;
  initialProfile: Profile | null;
  initialAddresses: Address[];
  zones: ZoneOption[];
}) {
  const router = useRouter();
  const configured = hasSupabaseEnv();
  const [profile, setProfile] = useState(initialProfile);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [fullName, setFullName] = useState(initialProfile?.full_name ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const [form, setForm] = useState({
    label: "",
    wilayat: "",
    area_code: zones[0]?.code ?? "al_ansab",
    street: "",
    building: "",
    unit: "",
    landmark: "",
    notes: "",
    latitude: "",
    longitude: "",
    is_default: false,
  });

  useEffect(() => {
    if (!profile && configured) {
      // wait for login
    }
  }, [profile, configured]);

  if (!configured) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-5 text-sm text-muted-foreground">
        Connect Supabase to manage your profile and addresses.
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{dict.order.needLogin}</p>
        <LinkButton href={`/${locale}/login?next=/${locale}/profile`}>
          {dict.common.login}
        </LinkButton>
      </div>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          preferred_language: locale,
        })
        .eq("id", profile!.id);
      if (error) throw error;
      setProfile({
        ...profile!,
        full_name: fullName,
        phone: phone || null,
        preferred_language: locale,
      });
      setMessage(dict.common.save);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  function openNewAddress() {
    setEditing(null);
    setForm({
      label: "",
      wilayat: "",
      area_code: zones[0]?.code ?? "al_ansab",
      street: "",
      building: "",
      unit: "",
      landmark: "",
      notes: "",
      latitude: "",
      longitude: "",
      is_default: addresses.length === 0,
    });
    setShowAddressForm(true);
  }

  function openEditAddress(address: Address) {
    setEditing(address);
    setForm({
      label: address.label ?? "",
      wilayat: address.wilayat ?? "",
      area_code: address.area_code,
      street: address.street ?? "",
      building: address.building ?? "",
      unit: address.unit ?? "",
      landmark: address.landmark ?? "",
      notes: address.notes ?? "",
      latitude: address.latitude?.toString() ?? "",
      longitude: address.longitude?.toString() ?? "",
      is_default: address.is_default,
    });
    setShowAddressForm(true);
  }

  async function useGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }));
      },
      () => {
        // non-blocking
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const zone =
        zones.find((z) => z.code === form.area_code) ??
        SERVICE_ZONE_SEEDS.find((z) => z.code === form.area_code)!;

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("profile_id", profile!.id)
        .maybeSingle();

      if (!customer) throw new Error(dict.common.error);

      const payload = {
        customer_id: (customer as { id: string }).id,
        label: form.label || null,
        area_code: form.area_code,
        area_name_en: zone.name_en,
        area_name_ar: zone.name_ar,
        street: form.street || null,
        building: form.building || null,
        unit: form.unit || null,
        landmark: form.landmark || null,
        wilayat: form.wilayat || null,
        governorate: "Muscat",
        notes: form.notes || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        is_default: form.is_default,
      };

      if (editing) {
        const { data, error } = await supabase
          .from("addresses")
          .update(payload)
          .eq("id", editing.id)
          .select("*")
          .single();
        if (error) throw error;
        setAddresses((list) =>
          list.map((a) => (a.id === editing.id ? (data as Address) : a)),
        );
      } else {
        const { data, error } = await supabase
          .from("addresses")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        setAddresses((list) => [...list, data as Address]);
      }

      setShowAddressForm(false);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAddress(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (!error) {
      setAddresses((list) => list.filter((a) => a.id !== id));
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border/70 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-primary">
          {dict.profile.details}
        </h2>
        <form className="mt-4 space-y-3" onSubmit={saveProfile}>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{dict.auth.fullName}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{dict.auth.phone}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{dict.auth.preferredLanguage}</Label>
            <p className="text-sm text-muted-foreground">
              {locale === "ar" ? dict.common.arabic : dict.common.english}
            </p>
          </div>
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          <Button type="submit" disabled={saving}>
            {dict.common.save}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border/70 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-primary">
            {dict.profile.addresses}
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={openNewAddress}>
            {dict.profile.addAddress}
          </Button>
        </div>
        {addresses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {dict.profile.noAddresses}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {address.label ||
                        (locale === "ar"
                          ? address.area_name_ar
                          : address.area_name_en)}
                      {address.is_default ? (
                        <span className="ms-2 text-xs text-primary">
                          ({dict.common.default})
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {[
                        locale === "ar"
                          ? address.area_name_ar
                          : address.area_name_en,
                        address.street,
                        address.building,
                        address.unit,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => openEditAddress(address)}
                    >
                      {dict.common.edit}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => deleteAddress(address.id)}
                    >
                      {dict.common.delete}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showAddressForm ? (
          <form className="mt-5 space-y-3 border-t border-border/60 pt-5" onSubmit={saveAddress}>
            <h3 className="font-medium">
              {editing ? dict.profile.editAddress : dict.profile.addAddress}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{dict.address.name}</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.governorate}</Label>
                <Input value={dict.common.muscat} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.wilayat}</Label>
                <Input
                  value={form.wilayat}
                  onChange={(e) => setForm({ ...form, wilayat: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.area}</Label>
                <select
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={form.area_code}
                  onChange={(e) =>
                    setForm({ ...form, area_code: e.target.value })
                  }
                  required
                >
                  {(zones.length ? zones : SERVICE_ZONE_SEEDS).map((zone) => (
                    <option key={zone.code} value={zone.code}>
                      {locale === "ar" ? zone.name_ar : zone.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.street}</Label>
                <Input
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.building}</Label>
                <Input
                  value={form.building}
                  onChange={(e) =>
                    setForm({ ...form, building: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.apartment}</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dict.address.landmark}</Label>
                <Input
                  value={form.landmark}
                  onChange={(e) =>
                    setForm({ ...form, landmark: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{dict.address.notes}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={useGeolocation}>
                {dict.address.useLocation}
              </Button>
              <span className="text-xs text-muted-foreground">
                {dict.address.locationHint}
              </span>
            </div>
            {(form.latitude || form.longitude) && (
              <p className="text-xs tabular-nums text-muted-foreground">
                {form.latitude}, {form.longitude}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
              />
              {dict.address.setDefault}
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {dict.common.save}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddressForm(false)}
              >
                {dict.common.cancel}
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-2 rounded-2xl border border-border/70 bg-white p-5 text-sm">
        <LinkButton href={`/${locale}/contact`} variant="ghost" className="justify-start px-0">
          {dict.profile.support}
        </LinkButton>
        <LinkButton href={`/${locale}/terms`} variant="ghost" className="justify-start px-0">
          {dict.profile.terms}
        </LinkButton>
        <LinkButton href={`/${locale}/privacy`} variant="ghost" className="justify-start px-0">
          {dict.profile.privacy}
        </LinkButton>
        <Button type="button" variant="outline" onClick={logout}>
          {dict.common.logout}
        </Button>
      </section>
    </div>
  );
}
