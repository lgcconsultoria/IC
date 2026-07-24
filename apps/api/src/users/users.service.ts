import { ForbiddenException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import { AppUser, isStaff } from '../auth/app-user';

@Injectable()
export class UsersService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
    private readonly cfg: ConfigService,
  ) {}

  async getMe(user: AppUser) {
    // user.id é o public.users.id (o guard já resolveu a linha do usuário).
    const { data, error } = await this.db
      .from('users')
      .select('id, nome, email, phone, role, crm, especialidade')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) {
      // fallback: devolve o que o guard já resolveu, para nunca 404 um usuário válido
      return {
        id: user.id, nome: user.nome, email: user.email,
        phone: null, role: user.role, crm: null, especialidade: null,
      };
    }
    return data;
  }

  async updateMe(user: AppUser, body: Partial<{ nome: string; phone: string; crm: string; especialidade: string; role: string }>) {
    const allowed: Record<string, unknown> = {};
    if (body.nome !== undefined) allowed.nome = body.nome;
    if (body.phone !== undefined) allowed.phone = body.phone;
    if (body.crm !== undefined) allowed.crm = body.crm;
    if (body.especialidade !== undefined) allowed.especialidade = body.especialidade;
    // role change only allowed for admins
    if (body.role !== undefined && user.role === 'admin') allowed.role = body.role;

    const { data, error } = await this.db
      .from('users')
      .update(allowed)
      .eq('id', user.id)
      .select('id, nome, email, phone, role, crm, especialidade')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async listStaff(user: AppUser) {
    if (!isStaff(user)) throw new ForbiddenException('Acesso negado');
    const { data, error } = await this.db
      .from('users')
      .select('id, nome, email, role, especialidade, crm, ativo')
      .eq('clinic_id', user.clinicId)
      .neq('role', 'paciente')
      .order('nome');
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async inviteStaff(user: AppUser, body: { nome: string; email: string; role: string; especialidade?: string; crm?: string }) {
    if (!isStaff(user)) throw new ForbiddenException('Acesso negado');

    // Create user row first (auth_uid will be linked later by trigger)
    const { data: newUser, error: userErr } = await this.db
      .from('users')
      .insert({
        clinic_id: user.clinicId,
        role: body.role,
        nome: body.nome,
        email: body.email,
        especialidade: body.especialidade ?? null,
        crm: body.crm ?? null,
        ativo: true,
      })
      .select('id')
      .single();
    if (userErr || !newUser) throw new InternalServerErrorException(userErr?.message ?? 'Erro ao criar funcionário');

    // Send invite email via Supabase Auth
    const supabaseUrl = this.cfg.get<string>('SUPABASE_URL') ?? '';
    const serviceKey = this.cfg.get<string>('SUPABASE_SECRET_KEY') ?? '';
    const appUrl = this.cfg.get<string>('APP_URL') ?? 'https://ic-web.vercel.app';

    const res = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ email: body.email, data: { nome: body.nome, role: body.role }, redirect_to: `${appUrl}/clinica` }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new InternalServerErrorException(`Falha ao enviar convite: ${txt}`);
    }

    return { id: newUser.id, email: body.email };
  }
}
