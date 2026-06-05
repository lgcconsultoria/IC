import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PatientsModule } from './patients/patients.module';
import { WearablesModule } from './wearables/wearables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // carrega o .env da raiz do monorepo (e um .env local do app, se houver)
      envFilePath: ['../../.env', '.env'],
    }),
    SupabaseModule,
    AuthModule,
    HealthModule,
    PatientsModule,
    WearablesModule,
  ],
})
export class AppModule {}
