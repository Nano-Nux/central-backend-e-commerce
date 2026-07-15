import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type CreateEmailTemplateInput = {
  name: string;
  subject: string;
  body: string;
};

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  createTemplate(input: CreateEmailTemplateInput) {
    return this.prisma.emailTemplate.create({
      data: input,
    });
  }

  findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async renderTemplate(
    name: string,
    variables: Record<string, string | number | boolean>,
  ) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { name },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    return {
      subject: this.render(template.subject, variables),
      body: this.render(template.body, variables),
    };
  }

  private render(
    value: string,
    variables: Record<string, string | number | boolean>,
  ) {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(variables, key)
        ? String(variables[key])
        : '',
    );
  }
}
