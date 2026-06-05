import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase para o navegador.
 * Usa a publishable key — segura no front desde que RLS esteja ativo e com
 * policies configuradas. Nunca use a secret key aqui.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env',
  );
}

export const supabase = createClient(url, publishableKey);
