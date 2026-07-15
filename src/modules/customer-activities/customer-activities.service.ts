import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { SystemEvents } from '../../common/constants/event.constants';
import { EventBusService } from '../../infrastructure/event-bus/event-bus.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type RecordCustomerActivityInput = {
  customerId: string;
  eventKey?: string;
  type: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class CustomerActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async recordActivity(input: RecordCustomerActivityInput) {
    if (input.eventKey) {
      const existing = await this.prisma.customerActivity.findUnique({
        where: { eventKey: input.eventKey },
      });

      if (existing) {
        return existing;
      }
    }

    let activity;

    try {
      activity = await this.prisma.customerActivity.create({
        data: {
          customerId: input.customerId,
          eventKey: input.eventKey,
          type: input.type,
          description: input.description,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      if (
        input.eventKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.customerActivity.findUnique({
          where: { eventKey: input.eventKey },
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }

    await this.eventBus.emit(SystemEvents.CUSTOMER_ACTIVITY_RECORDED, {
      activityId: activity.id,
      customerId: activity.customerId,
      type: activity.type,
      description: activity.description,
      metadata: activity.metadata,
    });

    return activity;
  }

  findByCustomer(customerId: string) {
    return this.prisma.customerActivity.findMany({
      where: { customerId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
