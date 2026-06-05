import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase.module';

interface RookPhysicalPayload {
  user_id?: string;
  data_structure?: string;
  physical_health?: {
    summary?: {
      physical_summary?: {
        metadata?: { datetime_string?: string };
        distance?: { steps_int?: number; traveled_distance_meters_float?: number };
        calories?: { calories_expenditure_kcal_float?: number };
        heart_rate?: { hr_avg_bpm_int?: number; hr_maximum_bpm_int?: number; hrv_avg_rmssd_float?: number };
        activity?: { active_seconds_int?: number };
      };
    };
  };
  sleep_health?: {
    summary?: {
      sleep_summary?: {
        metadata?: { datetime_string?: string; sources_of_data_array?: string[] };
        duration?: { sleep_duration_seconds_int?: number };
        heart_rate?: { hr_avg_bpm_int?: number; hrv_avg_rmssd_float?: number };
      };
    };
  };
}

@Injectable()
export class RookWebhookService {
  private readonly logger = new Logger(RookWebhookService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly db: SupabaseClient) {}

  async process(payload: RookPhysicalPayload): Promise<void> {
    const type = payload.data_structure ?? 'unknown';
    const userId = payload.user_id;
    if (!userId) {
      this.logger.warn('Webhook ROOK sem user_id');
      return;
    }

    const patient = await this.resolvePatient(userId);
    if (!patient) {
      this.logger.warn(`Webhook ROOK: paciente não encontrado para rook_user_id=${userId}`);
      return;
    }

    if (type === 'physical_summary') {
      await this.upsertPhysical(patient.id, payload);
    } else if (type === 'sleep_summary') {
      await this.upsertSleep(patient.id, payload);
    } else {
      this.logger.log(`ROOK webhook tipo=${type} ignorado`);
    }
  }

  private async resolvePatient(rookUserId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('wearable_connections')
      .select('patient_id')
      .eq('terra_user_id', rookUserId)
      .single();
    if (data) return { id: data.patient_id as string };

    // fallback: procura por user_id direto na tabela users (rook_user_id = auth uuid)
    const { data: p } = await this.db
      .from('patients')
      .select('id, user_id')
      .eq('user_id', (await this.db.from('users').select('id').eq('rook_user_id', rookUserId).single()).data?.id)
      .single();
    return p ? { id: p.id as string } : null;
  }

  private async upsertPhysical(patientId: string, p: RookPhysicalPayload) {
    const s = p.physical_health?.summary?.physical_summary;
    if (!s) return;
    const date = (s.metadata?.datetime_string ?? '').slice(0, 10);
    if (!date) return;

    await this.db.from('wearable_daily').upsert({
      patient_id: patientId,
      data: date,
      passos: s.distance?.steps_int ?? null,
      kcal_gastas: s.calories?.calories_expenditure_kcal_float
        ? Math.round(s.calories.calories_expenditure_kcal_float)
        : null,
      fc_media: s.heart_rate?.hr_avg_bpm_int ?? null,
      fc_max: s.heart_rate?.hr_maximum_bpm_int ?? null,
      hrv: s.heart_rate?.hrv_avg_rmssd_float ?? null,
      distancia_m: s.distance?.traveled_distance_meters_float
        ? Math.round(s.distance.traveled_distance_meters_float)
        : null,
      minutos_ativos: s.activity?.active_seconds_int
        ? Math.round(s.activity.active_seconds_int / 60)
        : null,
      fonte: 'rook',
      raw: p as unknown as Record<string, unknown>,
    }, { onConflict: 'patient_id,data,fonte' });

    this.logger.log(`Physical summary upserted patient=${patientId} date=${date}`);
  }

  private async upsertSleep(patientId: string, p: RookPhysicalPayload) {
    const s = p.sleep_health?.summary?.sleep_summary;
    if (!s) return;
    const date = (s.metadata?.datetime_string ?? '').slice(0, 10);
    if (!date) return;

    const existingRow = await this.db
      .from('wearable_daily')
      .select('id, sono_min, hrv')
      .eq('patient_id', patientId)
      .eq('data', date)
      .eq('fonte', 'rook')
      .single();

    const sonoMin = s.duration?.sleep_duration_seconds_int
      ? Math.round(s.duration.sleep_duration_seconds_int / 60)
      : null;
    const hrv = s.heart_rate?.hrv_avg_rmssd_float ?? null;

    if (existingRow.data) {
      await this.db.from('wearable_daily').update({ sono_min: sonoMin, hrv }).eq('id', existingRow.data.id);
    } else {
      await this.db.from('wearable_daily').upsert({
        patient_id: patientId,
        data: date,
        sono_min: sonoMin,
        hrv,
        fonte: 'rook',
        raw: p as unknown as Record<string, unknown>,
      }, { onConflict: 'patient_id,data,fonte' });
    }
    this.logger.log(`Sleep summary upserted patient=${patientId} date=${date}`);
  }
}
