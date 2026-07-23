import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { GarminService } from './garmin.service';

const QUEUE = 'garmin-poll';
const REPEAT_JOB = 'poll-all';

/**
 * Poller de coleta Garmin (BullMQ). Roda no HOST PERSISTENTE (Railway/Render/Fly)
 * junto com a API — NÃO na Vercel serverless. Se REDIS_URL não estiver definida
 * (ex.: ambiente serverless), o poller simplesmente não inicia e a API sobe
 * normalmente; a coleta pode então ser disparada sob demanda por POST /garmin/sync.
 */
@Injectable()
export class GarminPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GarminPoller.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly cfg: ConfigService,
    private readonly garmin: GarminService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.cfg.get<string>('REDIS_URL');
    const enabled = this.cfg.get<string>('GARMIN_POLL_ENABLED') !== 'false';
    if (!redisUrl || !enabled) {
      this.logger.log('Poller Garmin desativado (sem REDIS_URL ou GARMIN_POLL_ENABLED=false)');
      return;
    }

    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    const connection = this.connection as unknown as ConnectionOptions;

    this.queue = new Queue(QUEUE, { connection });
    const intervalMs = Number(this.cfg.get('GARMIN_POLL_INTERVAL_MS') ?? 6 * 60 * 60 * 1000);
    await this.queue.add(
      REPEAT_JOB,
      {},
      {
        repeat: { every: intervalMs },
        jobId: 'garmin-poll-all',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );

    this.worker = new Worker(QUEUE, () => this.pollAll(), { connection });
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Poll job ${job?.id} falhou: ${err.message}`),
    );
    this.logger.log(`Poller Garmin ativo (intervalo ${Math.round(intervalMs / 60000)}min)`);
  }

  private async pollAll(): Promise<void> {
    const ids = await this.garmin.listActivePatientIds();
    this.logger.log(`Poll Garmin: ${ids.length} paciente(s) ativo(s)`);
    for (const id of ids) {
      // Janela curta (padrão do sidecar) com re-pull para pegar dados atrasados.
      await this.garmin.syncPatient(id, null).catch((e) =>
        this.logger.warn(`Poll patient=${id} falhou: ${e}`),
      );
      // Jitter simples para não martelar o Garmin com N logins simultâneos.
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }
}
