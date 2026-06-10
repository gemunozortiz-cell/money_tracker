/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auth hook. Tracks the active Supabase session and exposes sign-in / sign-up /
 * sign-out helpers. When Supabase isn't configured, returns a "not configured"
 * state so the app can fall back to local-only mode without crashing.
 */

import { useState, useEffect, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export interface UseAuthResult {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      // Seed the Realtime socket with the current access token so its JWT
      // doesn't go stale and loop on CHANNEL_ERROR.
      if (data.session?.access_token) {
        try { supabase!.realtime.setAuth(data.session.access_token); } catch {}
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      // CRITICAL: when Supabase refreshes the token (~hourly) or signs in,
      // hand the fresh token to the Realtime socket. Without this the
      // websocket keeps using the expired JWT and reconnect-loops forever.
      if (newSession?.access_token) {
        try { supabase!.realtime.setAuth(newSession.access_token); } catch {}
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase no está configurado") };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase no está configurado"), needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    // If Supabase returned a user but no session, email confirmation is required
    const needsConfirmation = !!data?.user && !data?.session;
    return { error: error as Error | null, needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user: session?.user || null,
    loading,
    configured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
  };
}
