import { IsString, MinLength } from 'class-validator';

export class ConnectDto {
  @IsString()
  @MinLength(10, { message: 'Cole a URL/código MCP do Garmin (amalgama)' })
  mcpUrl!: string;
}
