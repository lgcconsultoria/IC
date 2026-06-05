import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  dataNasc?: string;

  @IsOptional()
  @IsIn(['F', 'M', 'outro'])
  sexo?: 'F' | 'M' | 'outro';

  @IsOptional()
  @IsNumber()
  alturaCm?: number;

  @IsOptional()
  @IsString()
  objetivo?: string;
}
