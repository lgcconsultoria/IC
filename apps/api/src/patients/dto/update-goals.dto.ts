import { IsNumber, IsOptional } from 'class-validator';

export class UpdateGoalsDto {
  @IsOptional()
  @IsNumber()
  metaPassos?: number;

  @IsOptional()
  @IsNumber()
  metaKcal?: number;

  @IsOptional()
  @IsNumber()
  metaTreinos?: number;

  @IsOptional()
  @IsNumber()
  metaMinAtivos?: number;

  @IsOptional()
  @IsNumber()
  metaSonoH?: number;

  @IsOptional()
  @IsNumber()
  metaPesoKg?: number;
}
