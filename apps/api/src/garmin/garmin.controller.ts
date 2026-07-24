import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { GarminService } from './garmin.service';
import { ConnectDto } from './dto/connect.dto';

@ApiTags('garmin')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('garmin')
export class GarminController {
  constructor(private readonly garmin: GarminService) {}

  @Post('connect')
  @ApiOperation({ summary: 'Conecta o Garmin do paciente via URL MCP (amalgama).' })
  connect(@CurrentUser() user: AppUser, @Body() dto: ConnectDto) {
    return this.garmin.connect(user, dto.mcpUrl);
  }

  @Get('status')
  @ApiOperation({ summary: 'Status da conexão Garmin do paciente autenticado.' })
  status(@CurrentUser() user: AppUser) {
    return this.garmin.status(user);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Dispara uma coleta imediata dos dados Garmin do paciente.' })
  async sync(@CurrentUser() user: AppUser) {
    const patientId = await this.garmin.resolvePatientId(user);
    await this.garmin.syncPatient(patientId, null);
    return { synced: true };
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Desconecta o Garmin e remove a URL MCP do paciente.' })
  disconnect(@CurrentUser() user: AppUser) {
    return this.garmin.disconnect(user);
  }
}
