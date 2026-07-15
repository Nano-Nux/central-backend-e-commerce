import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../../../generated/prisma/enums';
import { createPaginationMeta, normalizePagination } from '../shared/helpers/pagination.helper';

import {
  normalizeEmail,
  sanitizePlainText,
} from '../../common/utils/input-sanitizer.util';
import { CreateUserDto } from './dto/create-user.dto';
import { DEFAULT_ROLE_NAMES, UserRoleNames } from './user-roles';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditContext, AuditService } from '../audit/audit.service';

type UserRecord = Awaited<ReturnType<UsersRepository['findAll']>>[number];
type AuthUserRecord = NonNullable<
  Awaited<ReturnType<UsersRepository['findByEmailForAuth']>>
>;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultRoles();
    await this.seedAdminFromEnv();
  }

  async findAll(page = 1, limit = 20) {
    const pagination = normalizePagination(page, limit);
    const [users, total] = await Promise.all([
      this.usersRepository.findAll({ skip: pagination.skip, take: pagination.take }),
      this.usersRepository.count(),
    ]);
    return {
      data: users.map((user) => this.toResponse(user)),
      pagination: createPaginationMeta(pagination.page, pagination.limit, total),
    };
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async update(id: string, dto: UpdateUserDto, context?: AuditContext) {
    const before = await this.findOne(id);
    if (dto.password) {
      this.assertPasswordStrength(dto.password);
    }
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;
    const updated = await this.usersRepository.update(id, {
      name: dto.name === undefined ? undefined : sanitizePlainText(dto.name),
      status: dto.status,
      passwordHash,
    });

    this.auditService.logUpdate('USER', id, before, updated, undefined, context);
    return updated;
  }

  async remove(id: string, context?: AuditContext) {
    return this.update(id, { status: UserStatus.INACTIVE }, context);
  }

  async findMe(id: string) {
    return this.findOne(id);
  }

  findByEmailForAuth(email: string) {
    return this.usersRepository.findByEmailForAuth(email);
  }

  findByIdForAuth(id: string) {
    return this.usersRepository.findByIdForAuth(id);
  }

  async createWithPasswordHash(data: {
    name: string;
    email: string;
    passwordHash: string;
    status?: UserStatus;
    roleNames?: string[];
  }) {
    const user = await this.usersRepository.create({
      name: sanitizePlainText(data.name),
      email: normalizeEmail(data.email) ?? data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      status: data.status,
    });

    await this.assignRoles(user.id, data.roleNames ?? []);

    return this.findOne(user.id);
  }

  async createStaffUser(dto: CreateUserDto) {
    this.assertPasswordStrength(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.createWithPasswordHash({
      name: sanitizePlainText(dto.name),
      email: normalizeEmail(dto.email) ?? dto.email.toLowerCase(),
      passwordHash,
      status: UserStatus.ACTIVE,
      roleNames: dto.roles?.length ? dto.roles : [UserRoleNames.STAFF],
    });
  }

  listRoles() { return this.usersRepository.listRoles(); }
  async findRole(id: string) {
    const role = await this.usersRepository.findRoleById(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
  createRole(name: string) { return this.usersRepository.createRole(name.trim()); }
  updateRole(id: string, name: string) { return this.usersRepository.updateRole(id, name.trim()); }
  deleteRole(id: string) { return this.usersRepository.deleteRole(id); }

  private async seedDefaultRoles() {
    await Promise.all(
      DEFAULT_ROLE_NAMES.map((roleName) =>
        this.usersRepository.upsertRole(roleName),
      ),
    );
  }

  private async seedAdminFromEnv() {
    const name =
      this.configService.get<string>('ADMIN_NAME') ??
      this.configService.get<string>('ADMIN_USERNAME');
    const email = this.configService.get<string>('ADMIN_EMAIL');
    const password = this.configService.get<string>('ADMIN_PASSWORD');

    if (!name && !email && !password) {
      return;
    }

    if (!name || !email || !password) {
      throw new Error(
        'ADMIN_NAME or ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set together',
      );
    }

    this.assertPasswordStrength(password);

    const existingAdmin = await this.usersRepository.findByEmailForAuth(
      normalizeEmail(email) ?? email.toLowerCase(),
    );

    if (existingAdmin) {
      await this.assignRoles(existingAdmin.id, [UserRoleNames.ADMIN]);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.createWithPasswordHash({
      name,
      email: normalizeEmail(email) ?? email.toLowerCase(),
      passwordHash,
      status: UserStatus.ACTIVE,
      roleNames: [UserRoleNames.ADMIN],
    });

    this.logger.log(`Admin account bootstrapped for ${user.email}`);
  }

  private async assignRoles(userId: string, roleNames: string[]) {
    for (const roleName of roleNames) {
      const role = await this.usersRepository.upsertRole(roleName);

      await this.usersRepository.assignRole(userId, role.id);
    }
  }

  private assertPasswordStrength(password: string) {
    const hasRequiredCharacters =
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z\d]/.test(password);

    if (password.length < 8 || !hasRequiredCharacters) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      );
    }
  }

  private toResponse(user: UserRecord) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map((userRole) => userRole.role),
    };
  }

  toAuthResponse(user: AuthUserRecord) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles.map((userRole) => userRole.role),
    };
  }
}
