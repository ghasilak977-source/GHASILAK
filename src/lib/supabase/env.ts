export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseConfiguredMessage(): string {
  return "Connect Supabase via .env.local to enable live catalog, auth, and orders.";
}
