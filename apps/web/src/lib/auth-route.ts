/* IC Clínica — Resolução de papel e rota inicial pós-login.
   Robusto: tenta a API e, se falhar, lê o próprio papel direto do Supabase
   (política users_self_select), para o roteamento nunca depender da API no ar. */
import { getSupabase } from './supabase';

export const STAFF_ROLES = ['admin', 'medico', 'nutri', 'recepcao'];

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Papel do usuário logado (API → fallback Supabase). null se indeterminado. */
export async function fetchRole(): Promise<string | null> {
  try {
    const { apiFetch } = await import('./api');
    const me = await apiFetch<{ role?: string }>('/users/me');
    if (me?.role) return me.role;
  } catch {
    /* cai no fallback direto do Supabase */
  }
  try {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) return null;
    const { data } = await getSupabase()
      .from('users')
      .select('role')
      .eq('auth_uid', user.id)
      .maybeSingle();
    return (data?.role as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Rota inicial pelo papel. `fallback` decide o destino quando o papel é
 * indeterminado (ex.: na página de login da equipe assume-se equipe).
 */
export async function homeRoute(fallback: '/clinica' | '/portal/painel'): Promise<string> {
  const role = await fetchRole();
  if (role === 'paciente') return '/portal/painel';
  if (isStaffRole(role)) return '/clinica';
  return fallback;
}
