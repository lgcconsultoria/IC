import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import type { AppUser } from './app-user';

/**
 * Valida o token JWT do Supabase enviado no header Authorization: Bearer <token>.
 * Resolve o usuário da aplicação (public.users) e o anexa em request.appUser.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice('Bearer '.length);

    const { data: authData, error } = await this.supabase.auth.getUser(token);
    if (error || !authData.user) {
      throw new UnauthorizedException('Token inválido');
    }

    const { data: row, error: rowError } = await this.supabase
      .from('users')
      .select('id, clinic_id, auth_uid, role, nome, email')
      .eq('auth_uid', authData.user.id)
      .single();

    if (rowError || !row) {
      throw new UnauthorizedException('Usuário não provisionado');
    }

    const appUser: AppUser = {
      id: row.id,
      clinicId: row.clinic_id,
      authUid: row.auth_uid,
      role: row.role,
      nome: row.nome,
      email: row.email,
    };
    (req as Request & { appUser: AppUser }).appUser = appUser;
    return true;
  }
}
