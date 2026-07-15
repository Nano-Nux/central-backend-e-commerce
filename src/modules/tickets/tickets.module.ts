import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsController } from './tickets.controller';
import { PublicTicketsController } from './public-tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController, PublicTicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
