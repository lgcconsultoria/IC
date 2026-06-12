import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [NutritionController],
  providers: [NutritionService],
})
export class NutritionModule {}
