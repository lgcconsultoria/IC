import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { RookService } from './rook.service';

@ApiTags('rook')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('rook')
export class RookController {
  constructor(private readonly rook: RookService) {}

  @Get('connection-url')
  @ApiOperation({ summary: 'Retorna a URL da Connection Page do ROOK para o paciente autenticado' })
  async connectionUrl(
    @CurrentUser() user: AppUser,
    @Query('redirect_url') redirectUrl?: string,
  ) {
    await this.rook.registerUser(user.id);
    return { url: this.rook.connectionUrl(user.id, redirectUrl) };
  }

  @Get('data-sources')
  @ApiOperation({ summary: 'Lista fontes de dados autorizadas para o usuário' })
  dataSources(@CurrentUser() user: AppUser) {
    return this.rook.getDataSources(user.id);
  }

  @Get('data-sources/:userId')
  @ApiOperation({ summary: 'Lista fontes de dados de um paciente (uso interno da equipe)' })
  dataSourcesForPatient(
    @CurrentUser() _user: AppUser,
    @Param('userId') userId: string,
  ) {
    return this.rook.getDataSources(userId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registra o usuário no ROOK (idempotente)' })
  async register(@CurrentUser() user: AppUser) {
    await this.rook.registerUser(user.id);
    return { registered: true, userId: user.id };
  }
}
