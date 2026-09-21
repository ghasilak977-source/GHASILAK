"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthForm({
  locale,
  dict,
  nextPath,
}: {
  locale: Locale;
  dict: Dictionary;
  nextPath?: string;
}) {
  const router = useRouter();
  const configured = useMemo(() => hasSupabaseEnv(), []);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = nextPath || `/${locale}/profile`;

  async function afterAuth() {
    router.push(redirectTo);
    router.refresh();
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError(dict.common.error);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone || undefined,
              preferred_language: locale,
            },
          },
        });
        if (signUpError) throw signUpError;
      }
      await afterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError(dict.auth.phoneHint);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone,
      });
      if (otpError) throw otpError;
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (verifyError) throw verifyError;
      await afterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.error);
    } finally {
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-border/70 bg-white p-5 text-sm text-muted-foreground">
        {dict.auth.emailHint} Connect Supabase in `.env.local` to enable auth.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
      <Tabs defaultValue="email">
        <TabsList className="w-full">
          <TabsTrigger value="email">{dict.auth.emailTab}</TabsTrigger>
          <TabsTrigger value="phone">{dict.auth.phoneTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <form className="space-y-3" onSubmit={onEmailSubmit}>
            {mode === "signup" ? (
              <>
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
                  <Label htmlFor="phoneSignup">{dict.auth.phone}</Label>
                  <Input
                    id="phoneSignup"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+968…"
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">{dict.auth.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{dict.auth.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">{dict.auth.emailHint}</p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "signin" ? dict.common.login : dict.common.signup}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-primary"
              onClick={() =>
                setMode((m) => (m === "signin" ? "signup" : "signin"))
              }
            >
              {mode === "signin" ? dict.auth.noAccount : dict.auth.hasAccount}
            </button>
          </form>
        </TabsContent>

        <TabsContent value="phone" className="mt-4">
          {!otpSent ? (
            <form className="space-y-3" onSubmit={sendOtp}>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{dict.auth.phone}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+968…"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">{dict.auth.phoneHint}</p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {dict.auth.sendOtp}
              </Button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={verifyOtp}>
              <div className="space-y-1.5">
                <Label htmlFor="otp">{dict.auth.otp}</Label>
                <Input
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {dict.auth.verifyOtp}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
