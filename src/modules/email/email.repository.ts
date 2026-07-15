import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';
import { CommunicationChannelType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const EMAIL_QUEUE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

@Injectable()
export class EmailRepository {
  constructor(private readonly prisma: PrismaService) {}

  queue(data: Prisma.EmailQueueCreateInput) {
    return this.prisma.emailQueue.create({ data });
  }

  findDue(limit: number, now = new Date()) {
    return this.prisma.emailQueue.findMany({
      where: {
        status: EMAIL_QUEUE_STATUS.PENDING,
        scheduledAt: {
          lte: now,
        },
      },
      take: limit,
      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  updateStatus(id: string, status: string, sentAt?: Date | null) {
    return this.prisma.emailQueue.update({
      where: { id },
      data: {
        status,
        sentAt,
      },
    });
  }

  getEmailChannel() {
    return this.prisma.communicationChannel.findFirst({
      where: {
        type: CommunicationChannelType.EMAIL,
        isEnabled: true,
      },
    });
  }

  upsertChannel(configJson: Prisma.InputJsonValue, isEnabled = true) {
    return this.prisma.communicationChannel.create({
      data: {
        type: CommunicationChannelType.EMAIL,
        configJson,
        isEnabled,
      },
    });
  }
}
