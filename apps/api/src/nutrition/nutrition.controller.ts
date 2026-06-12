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
import { NutritionService } from './nutrition.service';
import { SaveMealPlanDto } from './dto/save-meal-plan.dto';
import { CreateFoodLogDto } from './dto/create-food-log.dto';
import { AnalyzePhotoDto } from './dto/analyze-photo.dto';

@ApiTags('nutrition')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Get('patients/:id/meal-plan')
  getMealPlan(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.nutrition.getMealPlan(user, id);
  }

  @Put('patients/:id/meal-plan')
  saveMealPlan(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Body() dto: SaveMealPlanDto,
  ) {
    return this.nutrition.saveMealPlan(user, id, dto);
  }

  @Get('patients/:id/food-logs')
  listFoodLogs(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Query('date') date?: string,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.nutrition.listFoodLogs(user, id, d);
  }

  @Post('patients/:id/food-logs')
  addFoodLog(
    @CurrentUser() user: AppUser,
    @Param('id') id: string,
    @Body() dto: CreateFoodLogDto,
  ) {
    return this.nutrition.addFoodLog(user, id, dto);
  }

  @Post('nutrition/analyze-photo')
  analyzePhoto(@Body() dto: AnalyzePhotoDto) {
    return this.nutrition.analyzePhoto(dto.imageBase64, dto.mediaType);
  }
}
