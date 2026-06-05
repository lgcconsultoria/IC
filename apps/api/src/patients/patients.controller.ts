import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateMeasurementDto } from './dto/create-measurement.dto';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  list(@CurrentUser() user: AppUser) {
    return this.patients.list(user);
  }

  @Post()
  create(@CurrentUser() user: AppUser, @Body() dto: CreatePatientDto) {
    return this.patients.create(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.patients.findOne(user, id);
  }

  @Post(':id/measurements')
  addMeasurement(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    return this.patients.addMeasurement(user, id, dto);
  }

  @Get(':id/measurements')
  listMeasurements(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.patients.listMeasurements(user, id);
  }
}
