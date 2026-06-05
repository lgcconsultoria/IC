import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PatientsModule } from './patients/patients.module';
import { WearablesModule } from './wearables/wearables.module';
import { RookModule } from './rook/rook.module';
import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    SupabaseModule,
    AuthModule,
    HealthModule,
    PatientsModule,
    WearablesModule,
    RookModule,
    AiModule,
    UsersModule,
  ],
})
export class AppModule {}
