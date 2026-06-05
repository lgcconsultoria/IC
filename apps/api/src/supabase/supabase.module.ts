import { Global, Module } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_ADMIN = 'SUPABASE_ADMIN';

/**
 * Cliente Supabase com a secret key (service role).
 * Faz bypass de RLS — usar SOMENTE no backend, nunca expor ao cliente.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN,
      useFactory: (): SupabaseClient => {
        const url = process.env.SUPABASE_URL;
        const secret = process.env.SUPABASE_SECRET_KEY;
        if (!url || !secret) {
          throw new Error(
            'Defina SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente do backend',
          );
        }
        return createClient(url, secret, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      },
    },
  ],
  exports: [SUPABASE_ADMIN],
})
export class SupabaseModule {}
