import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMeasurementDto {
  @IsString()
  data!: string; // ISO date (YYYY-MM-DD)

  @IsOptional()
  @IsNumber()
  pesoKg?: number;

  @IsOptional()
  @IsNumber()
  percentualGordura?: number;

  @IsOptional()
  @IsNumber()
  circCintura?: number;

  @IsOptional()
  @IsString()
  obs?: string;
}
