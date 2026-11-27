import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "../types/auction";
import { maskEmail, sanitizeUsername, validateEmailAddress, validateSecureUsername } from "./teamRoomHelpers";

let cachedClient: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const url = meta?.VITE_SUPABASE_URL?.trim();
  const key = meta?.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

function mapSupabaseUser(user: User): AuthenticatedUser {
  const email = user.email || "";
  const rawMetaName = typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "";
  const fallbackFromEmail = sanitizeUsername(email.split("@")[0] || "player") || "player";
  const username = sanitizeUsername(rawMetaName) || fallbackFromEmail;
  return {
    userId: user.id,
    email,
    emailMasked: maskEmail(email),
    username,
    provider: "supabase",
    verified: Boolean(user.email_confirmed_at || user.confirmed_at),
  };
}

async function syncProfileBestEffort(client: SupabaseClient, user: User, username: string) {
  try {
    await client.from("profiles").upsert(
      {
        id: user.id,
        username,
        email: maskEmail(user.email || ""),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch {
    // profiles table is optional if user hasn't run schema.sql yet
  }
}

export async function getCurrentAuthUser(): Promise<AuthenticatedUser | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (!data.session?.user) return null;
  return mapSupabaseUser(data.session.user);
}

export function onAuthStateChanged(callback: (user: AuthenticatedUser | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? mapSupabaseUser(session.user) : null);
  });
  return () => subscription.unsubscribe();
}

export async function signUpWithEmailPassword(
  emailRaw: string,
  password: string,
  usernameRaw: string,
): Promise<{
  user?: AuthenticatedUser;
  needsEmailConfirmation?: boolean;
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: "Supabase Auth is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
  }
  const email = emailRaw.trim().toLowerCase();
  if (!validateEmailAddress(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  const unameCheck = validateSecureUsername(usernameRaw);
  if (!unameCheck.ok) {
    return { error: unameCheck.error };
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { username: unameCheck.username },
    },
  });

  if (error) return { error: error.message };
  if (data.user && data.session) {
    await syncProfileBestEffort(client, data.user, unameCheck.username);
    return { user: mapSupabaseUser(data.user) };
  }
  return { needsEmailConfirmation: true };
}

export async function signInWithEmailPassword(
  emailRaw: string,
  password: string,
): Promise<{ user?: AuthenticatedUser; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: "Supabase Auth is not configured." };
  }
  const email = emailRaw.trim().toLowerCase();
  if (!validateEmailAddress(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!password) {
    return { error: "Enter your password." };
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Authentication failed." };
  return { user: mapSupabaseUser(data.user) };
}

export async function sendEmailOtpCode(
  emailRaw: string,
  usernameRaw?: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: "Supabase Auth is not configured." };
  }
  const email = emailRaw.trim().toLowerCase();
  if (!validateEmailAddress(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  let cleanUsername: string | undefined;
  if (usernameRaw && usernameRaw.trim()) {
    const check = validateSecureUsername(usernameRaw);
    if (!check.ok) return { ok: false, error: check.error };
    cleanUsername = check.username;
  }
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: cleanUsername ? { username: cleanUsername } : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifyEmailOtpCode(
  emailRaw: string,
  tokenRaw: string,
  usernameRaw?: string,
): Promise<{ user?: AuthenticatedUser; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: "Supabase Auth is not configured." };
  }
  const email = emailRaw.trim().toLowerCase();
  const token = tokenRaw.trim();
  if (!token) return { error: "Enter the verification code sent to your email." };

  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Verification failed." };

  let currentUser = data.user;
  if (usernameRaw && usernameRaw.trim()) {
    const check = validateSecureUsername(usernameRaw);
    if (check.ok) {
      const updated = await client.auth.updateUser({ data: { username: check.username } });
      if (updated.data.user) currentUser = updated.data.user;
      await syncProfileBestEffort(client, currentUser, check.username);
    }
  }
  return { user: mapSupabaseUser(currentUser) };
}

export async function updateSecureUsername(
  usernameRaw: string,
): Promise<{ user?: AuthenticatedUser; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { error: "Supabase Auth is not configured." };
  const check = validateSecureUsername(usernameRaw);
  if (!check.ok) return { error: check.error };

  const { data, error } = await client.auth.updateUser({
    data: { username: check.username },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not update username." };
  await syncProfileBestEffort(client, data.user, check.username);
  return { user: mapSupabaseUser(data.user) };
}

export async function signOutAuth(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
}
