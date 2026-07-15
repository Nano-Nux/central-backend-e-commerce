import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const userSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  failedAttempts: true,
  lockedUntil: true,
  status: true,
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(params?: { skip?: number; take?: number }) {
    return this.prisma.user.findMany({
      skip: params?.skip,
      take: params?.take,
      select: userSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  count() {
    return this.prisma.user.count();
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  }

  findIdentityById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  findByIdForAuth(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: authUserSelect,
    });
  }

  findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: authUserSelect,
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: userSelect,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  findRoleByName(name: string) {
    return this.prisma.role.findFirst({
      where: { name },
    });
  }

  async upsertRole(name: string) {
    const existingRole = await this.findRoleByName(name);

    if (existingRole) {
      return existingRole;
    }

    return this.prisma.role.create({
      data: { name },
    });
  }

  assignRole(userId: string, roleId: string) {
    return this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      update: {},
      create: {
        userId,
        roleId,
      },
    });
  }

  listRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  findRoleById(id: string) {
    return this.prisma.role.findUnique({ where: { id } });
  }

  createRole(name: string) {
    return this.prisma.role.create({ data: { name } });
  }

  updateRole(id: string, name: string) {
    return this.prisma.role.update({ where: { id }, data: { name } });
  }

  deleteRole(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }
}
