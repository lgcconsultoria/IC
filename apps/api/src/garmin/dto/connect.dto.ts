import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConnectDto {
  @IsEmail({}, { message: 'E-mail do Garmin inválido' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  password!: string;
}
