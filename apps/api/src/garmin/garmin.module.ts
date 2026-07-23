import { Module } from '@nestjs/common';
import { GarminController } from './garmin.controller';
import { GarminService } from './garmin.service';
import { GarminConnectorClient } from './garmin-connector.client';
import { GarminPoller } from './garmin-poller';

@Module({
  controllers: [GarminController],
  providers: [GarminService, GarminConnectorClient, GarminPoller],
  exports: [GarminService],
})
export class GarminModule {}
