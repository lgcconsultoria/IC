import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AppUser } from '../auth/app-user';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { UpdateGoalsDto } from './dto/update-goals.dto';
import { UpdateMetabolismDto } from './dto/update-metabolism.dto';

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

  @Get('me')
  findMine(@CurrentUser() user: AppUser) {
    return this.patients.findMine(user);
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

  @Get(':id/wearable-daily')
  listWearableDaily(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.patients.listWearableDaily(user, id, days ? Number(days) : 30);
  }

  @Get(':id/wearable-activities')
  listWearableActivities(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.patients.listWearableActivities(
      user,
      id,
      days ? Number(days) : 30,
    );
  }

  @Get(':id/goals')
  getGoals(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.patients.getGoals(user, id);
  }

  @Put(':id/goals')
  saveGoals(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Body() dto: UpdateGoalsDto,
  ) {
    return this.patients.saveGoals(user, id, dto);
  }

  @Get(':id/metabolism')
  getMetabolism(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.patients.getMetabolism(user, id);
  }

  @Put(':id/metabolism')
  updateMetabolism(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Body() dto: UpdateMetabolismDto,
  ) {
    return this.patients.updateMetabolism(user, id, dto);
  }
}
