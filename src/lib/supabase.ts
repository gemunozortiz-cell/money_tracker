/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase client. Reads credentials from Vite env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * If not configured, the app falls back to local-only mode (localStorage).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
