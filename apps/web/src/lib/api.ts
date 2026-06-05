import { getSupabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

/** Chama a API NestJS anexando o access token do Supabase (Bearer). */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}
