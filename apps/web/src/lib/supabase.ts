import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase para o navegador (publishable key).
 * Criação lazy para não quebrar o build quando as envs não estão presentes.
 * Nunca use a secret key aqui.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    );
  }
  client = createClient(url, key);
  return client;
}
