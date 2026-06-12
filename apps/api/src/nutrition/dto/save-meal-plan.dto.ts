import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MealPlanItemDto {
  @IsString()
  refeicao!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  kcalEstimada?: number;
}

export class SaveMealPlanDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsInt()
  kcalMetaDia?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealPlanItemDto)
  itens!: MealPlanItemDto[];
}
