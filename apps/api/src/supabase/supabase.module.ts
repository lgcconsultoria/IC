import { Global, Module } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_ADMIN = 'SUPABASE_ADMIN';

/**
 * Cliente Supabase com a secret key (service role) — faz bypass de RLS.
 * Usar SOMENTE no backend, nunca expor ao cliente.
 *
 * O cliente é criado de forma LAZY (na primeira utilização) via Proxy, para
 * que a aplicação consiga inicializar mesmo em ambientes serverless onde a
 * validação de env só deve falhar no primeiro request — e não derrubar o boot.
 */
function createLazyAdminClient(): SupabaseClient {
  let real: SupabaseClient | null = null;

  const resolve = (): SupabaseClient => {
    if (real) return real;
    const url = process.env.SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secret) {
      throw new Error(
        'SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar definidas no ambiente do backend',
      );
    }
    real = createClient(url, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return real;
  };

  // Props que o NestJS sonda em TODO provider durante o boot (thenable +
  // hooks de ciclo de vida). Resolver o cliente nesses acessos forçaria as
  // envs do Supabase já no boot, quebrando a inicialização quando elas ainda
  // não estão setadas (ex.: primeiro deploy no host). Devolvendo undefined
  // para essas sondagens, o cliente permanece de fato lazy — a resolução real
  // só acontece no primeiro uso do banco.
  const LIFECYCLE_PROBES = new Set([
    'then',
    'onModuleInit',
    'onModuleDestroy',
    'onApplicationBootstrap',
    'beforeApplicationShutdown',
    'onApplicationShutdown',
  ]);

  return new Proxy({} as SupabaseClient, {
    get(_target, prop, receiver) {
      if (typeof prop === 'string' && LIFECYCLE_PROBES.has(prop)) return undefined;
      const client = resolve();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });
}

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN,
      useFactory: (): SupabaseClient => createLazyAdminClient(),
    },
  ],
  exports: [SUPABASE_ADMIN],
})
export class SupabaseModule {}
