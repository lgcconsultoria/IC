import { IsIn, IsInt, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateFoodLogDto {
  @IsString()
  data!: string; // YYYY-MM-DD

  @IsString()
  refeicao!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  kcalEstimada?: number;

  @IsOptional()
  @IsIn(['manual', 'ia'])
  fonte?: 'manual' | 'ia';

  @IsOptional()
  @IsObject()
  iaPayload?: Record<string, unknown>;
}
