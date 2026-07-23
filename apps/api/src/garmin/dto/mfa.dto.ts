import { IsString, Matches } from 'class-validator';

export class MfaDto {
  @IsString()
  @Matches(/^\d{4,10}$/, { message: 'Código MFA deve ter entre 4 e 10 dígitos' })
  code!: string;
}
