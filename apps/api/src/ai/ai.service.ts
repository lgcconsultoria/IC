import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface PatientMetrics {
  nome: string;
  idade?: number;
  objetivo?: string;
  periodo: string;
  passos_media?: number;
  kcal_media?: number;
  fc_media?: number;
  sono_media_min?: number;
  hrv_media?: number;
  minutos_ativos_media?: number;
  aderencia_pct?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(private cfg: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      const key = this.cfg.get<string>('CLAUDE_API_KEY');
      if (!key) throw new Error('CLAUDE_API_KEY não configurado');
      this.client = new Anthropic({ apiKey: key });
    }
    return this.client;
  }

  async generateReport(metrics: PatientMetrics): Promise<string> {
    const prompt = this.buildPrompt(metrics);

    const msg = await this.getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content.find((b) => b.type === 'text');
    return text?.text ?? 'Não foi possível gerar o relatório.';
  }

  private buildPrompt(m: PatientMetrics): string {
    const lines = [
      `Você é um assistente clínico especializado em análise de dados de wearables para equipes de saúde.`,
      `Gere um relatório clínico conciso (3–4 parágrafos, em português) para o seguinte paciente:`,
      ``,
      `**Paciente:** ${m.nome}`,
      m.idade ? `**Idade:** ${m.idade} anos` : '',
      m.objetivo ? `**Objetivo clínico:** ${m.objetivo}` : '',
      `**Período analisado:** ${m.periodo}`,
      ``,
      `**Métricas médias do período:**`,
      m.passos_media != null ? `- Passos/dia: ${Math.round(m.passos_media).toLocaleString('pt-BR')}` : '',
      m.kcal_media != null ? `- Calorias gastas/dia: ${Math.round(m.kcal_media)} kcal` : '',
      m.fc_media != null ? `- FC média: ${Math.round(m.fc_media)} bpm` : '',
      m.sono_media_min != null ? `- Sono médio: ${Math.round(m.sono_media_min / 60)}h${Math.round(m.sono_media_min % 60)}min` : '',
      m.hrv_media != null ? `- HRV médio (RMSSD): ${m.hrv_media.toFixed(1)} ms` : '',
      m.minutos_ativos_media != null ? `- Minutos ativos/dia: ${Math.round(m.minutos_ativos_media)} min` : '',
      m.aderencia_pct != null ? `- Aderência ao plano: ${m.aderencia_pct}%` : '',
    ].filter(Boolean);

    lines.push('', 'O relatório deve incluir: resumo da evolução, pontos de atenção, e recomendações práticas para a equipe clínica. Seja objetivo e use linguagem técnica de saúde.');
    return lines.join('\n');
  }
}
