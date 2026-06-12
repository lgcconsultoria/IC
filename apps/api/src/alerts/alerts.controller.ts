import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { AlertsService } from './alerts.service';

class UpdateAlertDto {
  @IsIn(['aberto', 'visto', 'resolvido'])
  status!: 'aberto' | 'visto' | 'resolvido';
}

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AppUser) {
    return this.alerts.listForClinic(user);
  }

  @Post('refresh')
  refresh(@CurrentUser() user: AppUser) {
    return this.alerts.refresh(user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alerts.updateStatus(user, id, dto.status);
  }
}
