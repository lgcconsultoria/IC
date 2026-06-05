import type { UserRole } from '@ic/types';

/** Usuário da aplicação (linha de public.users) resolvido a partir do JWT. */
export interface AppUser {
  id: string;
  clinicId: string;
  authUid: string;
  role: UserRole;
  nome: string;
  email: string;
}

export const STAFF_ROLES: UserRole[] = ['admin', 'medico', 'nutri', 'recepcao'];

export function isStaff(user: AppUser): boolean {
  return STAFF_ROLES.includes(user.role);
}
