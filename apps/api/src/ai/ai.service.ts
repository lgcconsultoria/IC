import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface MealItem {
  alimento: string;
  porcao: string;
  kcal: number;
}

export interface MealEstimate {
  descricao: string;
  kcal_total: number;
  confianca: number;
  itens: MealItem[];
}

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

  /** Estima alimentos e calorias a partir da foto de uma refeição (multimodal). */
  async analyzeMeal(
    base64: string,
    mediaType: string,
  ): Promise<MealEstimate> {
    const prompt = [
      'Você é um nutricionista. Analise a foto desta refeição e estime os alimentos e as calorias.',
      'Responda APENAS com um JSON válido, sem texto antes ou depois, no formato:',
      '{"descricao": string, "kcal_total": number, "confianca": number (0 a 1), "itens": [{"alimento": string, "porcao": string, "kcal": number}]}',
      'A descrição deve ser curta (ex.: "Arroz, feijão, frango grelhado e salada"). Seja realista nas porções.',
    ].join('\n');

    const msg = await this.getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg',
                data: base64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const raw = msg.content.find((b) => b.type === 'text')?.text ?? '{}';
    return this.parseMeal(raw);
  }

  private parseMeal(raw: string): MealEstimate {
    const fallback: MealEstimate = {
      descricao: 'Refeição',
      kcal_total: 0,
      confianca: 0,
      itens: [],
    };
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start < 0 || end < 0) return fallback;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<MealEstimate>;
      return {
        descricao: parsed.descricao ?? 'Refeição',
        kcal_total: Math.round(Number(parsed.kcal_total) || 0),
        confianca: Number(parsed.confianca) || 0,
        itens: Array.isArray(parsed.itens) ? parsed.itens : [],
      };
    } catch {
      this.logger.warn('Falha ao parsear resposta da IA de refeição');
      return fallback;
    }
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
