import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { isStaff } from '../auth/app-user';
import { AiService, PatientMetrics } from './ai.service';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';
import { ForbiddenException } from '@nestjs/common';

class GenerateReportDto {
  patientId!: string;
  periodo!: string; // ex: "Últimas 4 semanas"
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    @Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient,
  ) {}

  @Post('report')
  @ApiOperation({ summary: 'Gera relatório clínico com IA (Claude) para um paciente' })
  async generateReport(@CurrentUser() user: AppUser, @Body() dto: GenerateReportDto) {
    if (!isStaff(user)) throw new ForbiddenException('Acesso restrito à equipe');

    const [patientRow, wearableRows] = await Promise.all([
      this.db
        .from('patients')
        .select('id, objetivo, data_nasc, users(nome)')
        .eq('id', dto.patientId)
        .eq('clinic_id', user.clinicId)
        .single(),
      this.db
        .from('wearable_daily')
        .select('passos, kcal_gastas, fc_media, sono_min, hrv, minutos_ativos')
        .eq('patient_id', dto.patientId)
        .order('data', { ascending: false })
        .limit(30),
    ]);

    if (!patientRow.data) throw new ForbiddenException('Paciente não encontrado');

    const rows = wearableRows.data ?? [];
    const avg = (key: keyof typeof rows[0]) => {
      const vals = rows.map((r) => r[key]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
    };

    const p = patientRow.data;
    const nome = (p as unknown as { users?: { nome?: string } }).users?.nome ?? 'Paciente';
    const nasc = (p as { data_nasc?: string }).data_nasc;
    const idade = nasc ? Math.floor((Date.now() - new Date(nasc).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : undefined;

    const metrics: PatientMetrics = {
      nome,
      idade,
      objetivo: (p as { objetivo?: string }).objetivo ?? undefined,
      periodo: dto.periodo,
      passos_media: avg('passos'),
      kcal_media: avg('kcal_gastas'),
      fc_media: avg('fc_media'),
      sono_media_min: avg('sono_min'),
      hrv_media: avg('hrv'),
      minutos_ativos_media: avg('minutos_ativos'),
    };

    const report = await this.ai.generateReport(metrics);
    return { report, generated_at: new Date().toISOString() };
  }
}
