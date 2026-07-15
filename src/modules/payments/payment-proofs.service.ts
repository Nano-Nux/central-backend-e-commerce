import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import {
  OrderStatus,
  PaymentProofStatus,
  PaymentStatus,
} from '../../../generated/prisma/enums';
import {
  sanitizeStorageFilename,
  validateUploadedFile,
} from '../../common/utils/upload-validation.util';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext } from '../audit/audit.service';
import { PaymentsService } from './payments.service';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
};

const paymentProofSelect = {
  id: true,
  paymentId: true,
  orderId: true,
  status: true,
  bucket: true,
  objectName: true,
  originalFilename: true,
  contentType: true,
  size: true,
  rejectionReason: true,
  createdAt: true,
  reviewedAt: true,
} as const;

@Injectable()
export class PaymentProofsService {
  private readonly maxFileSizeBytes = 10 * 1024 * 1024;
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);
  private readonly allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.pdf',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async uploadProofForOrder(
    orderId: string,
    input: {
      paymentId?: string;
      uploadedByUserId?: string;
      file: UploadedFile;
    },
  ) {
    this.validateFile(input.file);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            status: true,
            reference: true,
            idempotencyKey: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Payment proofs are not allowed for this order',
      );
    }

    const payment = this.resolvePayment(order.payments, input.paymentId);

    if (payment.status === PaymentStatus.SUCCESS) {
      throw new ConflictException('Payment has already been completed');
    }

    const bucket = this.paymentProofBucket();
    const objectName =
      `payment-proofs/${order.id}/` +
      `${randomUUID()}-${this.sanitizeFilename(input.file.originalname)}`;

    await this.minioService.upload({
      bucket,
      objectName,
      data: input.file.buffer,
      size: input.file.size,
      contentType: input.file.mimetype,
    });

    return this.prisma.paymentProof.create({
      data: {
        paymentId: payment.id,
        orderId: order.id,
        bucket,
        objectName,
        originalFilename: input.file.originalname,
        contentType: input.file.mimetype,
        size: input.file.size,
        uploadedByUserId: input.uploadedByUserId,
      },
      select: paymentProofSelect,
    });
  }

  async listProofs(page = 1, limit = 20) {
    return this.prisma.paymentProof.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: paymentProofSelect,
    });
  }

  async getProofById(id: string) {
    const proof = await this.prisma.paymentProof.findUnique({
      where: { id },
      select: paymentProofSelect,
    });

    if (!proof) {
      throw new NotFoundException('Payment proof not found');
    }

    return proof;
  }

  async approveProof(id: string, context?: AuditContext) {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM payment_proofs
        WHERE id = ${id}
        FOR UPDATE
      `;

      const proof = await transaction.paymentProof.findUnique({
        where: { id },
        select: {
          id: true,
          paymentId: true,
          orderId: true,
          status: true,
        },
      });

      if (!proof) {
        throw new NotFoundException('Payment proof not found');
      }

      if (proof.status === PaymentProofStatus.APPROVED) {
        return {
          proof: await transaction.paymentProof.findUniqueOrThrow({
            where: { id },
            select: paymentProofSelect,
          }),
          payment: await transaction.payment.findUniqueOrThrow({
            where: { id: proof.paymentId },
            select: {
              id: true,
              orderId: true,
              method: true,
              amount: true,
              status: true,
              reference: true,
              idempotencyKey: true,
            },
          }),
          shouldFinalizePayment: false,
        };
      }

      if (proof.status === PaymentProofStatus.REJECTED) {
        throw new ConflictException(
          'Rejected payment proofs cannot be approved',
        );
      }

      const payment = await transaction.payment.findUnique({
        where: { id: proof.paymentId },
        select: {
          id: true,
          orderId: true,
          method: true,
          amount: true,
          status: true,
          reference: true,
          idempotencyKey: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const updatedProof = await transaction.paymentProof.update({
        where: { id },
        data: {},
        select: paymentProofSelect,
      });

      return {
        proof: updatedProof,
        payment,
        shouldFinalizePayment: payment.status !== PaymentStatus.SUCCESS,
      };
    });

    if (outcome.shouldFinalizePayment) {
      await this.paymentsService.recordPayment(
        {
          orderId: outcome.payment.orderId,
          method: outcome.payment.method,
          amount: Number(outcome.payment.amount.toString()),
          status: PaymentStatus.SUCCESS,
          reference:
            outcome.payment.reference ?? `payment-proof:${outcome.proof.id}`,
          idempotencyKey:
            outcome.payment.idempotencyKey ??
            `payment-proof-approval:${outcome.payment.id}`,
        },
        context,
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM payment_proofs
        WHERE id = ${id}
        FOR UPDATE
      `;

      const proof = await transaction.paymentProof.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });

      if (!proof) {
        throw new NotFoundException('Payment proof not found');
      }

      if (proof.status === PaymentProofStatus.REJECTED) {
        throw new ConflictException(
          'Rejected payment proofs cannot be approved',
        );
      }

      if (proof.status === PaymentProofStatus.APPROVED) {
        return;
      }

      await transaction.paymentProof.update({
        where: { id },
        data: {
          status: PaymentProofStatus.APPROVED,
          reviewedByUserId: context?.actorId ?? null,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
    });

    return this.getProofById(id);
  }

  async rejectProof(id: string, reason: string, context?: AuditContext) {
    const proof = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM payment_proofs
        WHERE id = ${id}
        FOR UPDATE
      `;

      const existing = await transaction.paymentProof.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Payment proof not found');
      }

      if (existing.status === PaymentProofStatus.APPROVED) {
        throw new ConflictException(
          'Approved payment proofs cannot be rejected',
        );
      }

      if (existing.status === PaymentProofStatus.REJECTED) {
        return transaction.paymentProof.findUniqueOrThrow({
          where: { id },
          select: paymentProofSelect,
        });
      }

      return transaction.paymentProof.update({
        where: { id },
        data: {
          status: PaymentProofStatus.REJECTED,
          rejectionReason: reason,
          reviewedByUserId: context?.actorId ?? null,
          reviewedAt: new Date(),
        },
        select: paymentProofSelect,
      });
    });

    return proof;
  }

  private resolvePayment(
    payments: Array<{
      id: string;
      method: string;
      amount: Prisma.Decimal;
      status: PaymentStatus;
      reference: string | null;
      idempotencyKey: string | null;
      createdAt: Date;
    }>,
    paymentId?: string,
  ) {
    if (paymentId) {
      const payment = payments.find((entry) => entry.id === paymentId);

      if (!payment) {
        throw new NotFoundException('Payment not found for this order');
      }

      return payment;
    }

    const awaitingVerificationPayment = payments.find(
      (entry) => entry.status === PaymentStatus.AWAITING_VERIFICATION,
    );

    if (awaitingVerificationPayment) {
      return awaitingVerificationPayment;
    }

    const pendingPayment = payments.find(
      (entry) => entry.status === PaymentStatus.PENDING,
    );

    if (pendingPayment) {
      return pendingPayment;
    }

    const latestPayment = payments[0];

    if (!latestPayment) {
      throw new NotFoundException('Order payment was not found');
    }

    return latestPayment;
  }

  private validateFile(file: UploadedFile) {
    validateUploadedFile(file, {
      allowedExtensions: this.allowedExtensions,
      allowedMimeTypes: [...this.allowedMimeTypes],
      maxFileSizeBytes: this.maxFileSizeBytes,
      fieldLabel: 'Payment proof',
    });
  }

  private paymentProofBucket() {
    return (
      this.configService.get<string>('MINIO_PAYMENT_PROOF_BUCKET') ??
      this.configService.getOrThrow<string>('MINIO_BUCKET')
    );
  }

  private sanitizeFilename(filename: string) {
    return sanitizeStorageFilename(filename);
  }
}
