import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const NIVEIS_ATIVIDADE = [
  'sedentario',
  'leve',
  'moderado',
  'intenso',
  'muito_intenso',
] as const;

export type NivelAtividade = (typeof NIVEIS_ATIVIDADE)[number];

export class UpdateMetabolismDto {
  /** Peso atual (kg) — usado no cálculo de TMB (Mifflin-St Jeor). */
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(400)
  pesoKg?: number;

  /** Nível de atividade física (fator do TDEE). */
  @IsOptional()
  @IsIn(NIVEIS_ATIVIDADE)
  nivelAtividade?: NivelAtividade;

  /**
   * Gasto energético em REPOUSO medido pela clínica (calorimetria/InBody), em kcal/dia.
   * Quando presente, substitui a TMB calculada. Somente equipe pode definir.
   */
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(5000)
  tmbMedidoKcal?: number;
}
