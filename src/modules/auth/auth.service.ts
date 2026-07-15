import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import { UserStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';
import {
  normalizeEmail,
  sanitizePlainText,
} from '../../common/utils/input-sanitizer.util';
import { UsersService } from '../users/users.service';
import { UserRoleNames } from '../users/user-roles';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

type AuthUser = NonNullable<
  Awaited<ReturnType<UsersService['findByEmailForAuth']>>
>;
type TokenDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-password', 12);

export type RegistrationResult = {
  accepted: true;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiresIn: TokenDuration;
  private readonly refreshTokenExpiresIn: TokenDuration;
  private readonly refreshTokenTtlMs: number;
  private readonly maxFailedAttempts = 5;
  private readonly lockoutDurationMs = 15 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {
    this.accessTokenExpiresIn = this.normalizeDuration(
      this.configService.get<string>('JWT_EXPIRES_IN'),
      '1d',
    );
    this.refreshTokenExpiresIn = this.normalizeDuration(
      this.configService.get<string>('REFRESH_EXPIRES_IN'),
      '30d',
    );
    this.refreshTokenTtlMs = this.parseDurationMs(this.refreshTokenExpiresIn);
  }

  async register(
    registerDto: RegisterDto,
    context?: AuditContext,
  ): Promise<RegistrationResult> {
    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const email = normalizeEmail(registerDto.email);

    if (!email) {
      throw new UnauthorizedException('Invalid email or password');
    }

    try {
      const user = await this.usersService.createWithPasswordHash({
        name: sanitizePlainText(registerDto.name),
        email,
        passwordHash,
        status: UserStatus.ACTIVE,
        roleNames: [UserRoleNames.CUSTOMER],
      });
      await this.ensureCustomerProfileAndClaimGuestOrders(
        user.id,
        user.name,
        user.email,
      );

      this.auditService.logAction(
        'REGISTER',
        'USER',
        user.id,
        undefined,
        undefined,
        { email: user.email },
        {
          actorId: user.id,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      );

      return { accepted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.auditService.logAction(
          'REGISTER_DUPLICATE_ATTEMPT',
          'AUTH',
          email,
          undefined,
          undefined,
          { email },
          context,
        );

        return { accepted: true };
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto, context?: AuditContext) {
    const email = normalizeEmail(loginDto.email);

    if (!email) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.debug(`Login attempt started for ${this.maskEmail(email)}`);

    const user = await this.usersService.findByEmailForAuth(email);

    this.logger.debug(
      `Login lookup for ${this.maskEmail(email)}: ${user ? 'found' : 'not found'}`,
    );

    if (!user || user.status !== UserStatus.ACTIVE) {
      await bcrypt.compare(loginDto.password, DUMMY_PASSWORD_HASH);
      this.auditService.logAction(
        'LOGIN_FAILED',
        'AUTH',
        email,
        undefined,
        undefined,
        { email, reason: !user ? 'USER_NOT_FOUND' : 'USER_INACTIVE' },
        context,
      );
      this.logger.debug(
        `Login rejected for ${this.maskEmail(email)}: ${
          !user ? 'missing user' : `status=${user.status}`
        }`,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.auditService.logAction(
        'LOGIN_BLOCKED',
        'USER',
        user.id,
        undefined,
        undefined,
        {
          email,
          lockedUntil: user.lockedUntil.toISOString(),
          reason: 'ACCOUNT_LOCKED',
        },
        {
          actorId: user.id,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await this.resetFailedLoginState(user.id);
      user.failedAttempts = 0;
      user.lockedUntil = null;
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    this.logger.debug(
      `Password check for ${this.maskEmail(email)}: ${isPasswordValid ? 'passed' : 'failed'}`,
    );

    if (!isPasswordValid) {
      await this.recordFailedLoginAttempt(user.id, user.failedAttempts);
      this.auditService.logAction(
        'LOGIN_FAILED',
        'USER',
        user.id,
        undefined,
        undefined,
        { email, reason: 'INVALID_PASSWORD' },
        {
          actorId: user.id,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.resetFailedLoginState(user.id);

    const tokens = await this.issueTokens(user);

    this.auditService.logAction(
      'LOGIN_SUCCEEDED',
      'USER',
      user.id,
      undefined,
      undefined,
      { email },
      {
        actorId: user.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    );

    const { roles: _roles, ...publicUser } = this.usersService.toAuthResponse(user);

    return {
      user: publicUser,
      ...tokens,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto, context?: AuditContext) {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    const tokenHash = this.hashToken(refreshTokenDto.refreshToken);
    const { storedToken, tokens } = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id
          FROM refresh_tokens
          WHERE token = ${tokenHash}
          FOR UPDATE
        `;

        const storedToken = await transaction.refreshToken.findUnique({
          where: { token: tokenHash },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                status: true,
              },
            },
          },
        });

        if (
          !storedToken ||
          storedToken.userId !== payload.sub ||
          storedToken.expiresAt <= new Date() ||
          storedToken.user.status !== UserStatus.ACTIVE
        ) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        await transaction.refreshToken.delete({
          where: { id: storedToken.id },
        });

        const refreshedUser = await this.usersService.findByIdForAuth(storedToken.user.id);
        if (!refreshedUser) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        const tokens = await this.issueTokens(refreshedUser, transaction);

        return { storedToken, tokens };
      },
    );

    this.auditService.logAction(
      'TOKEN_REFRESHED',
      'USER',
      storedToken.user.id,
      undefined,
      undefined,
      { email: storedToken.user.email },
      {
        actorId: storedToken.user.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    );

    return tokens;
  }

  async logout(userId: string, refreshToken?: string, context?: AuditContext) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: this.hashToken(refreshToken),
        },
      });
    } else {
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    this.auditService.logAction(
      'LOGOUT',
      'USER',
      userId,
      undefined,
      undefined,
      { refreshTokenProvided: Boolean(refreshToken) },
      context,
    );

    return { loggedOut: true };
  }

  private async issueTokens(
    user: Pick<AuthUser, 'id' | 'email'> & {
      roles?: Array<{ role: { name: string } }>;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const role = this.resolveAccessRole(user.roles ?? []);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('REFRESH_SECRET'),
        expiresIn: this.refreshTokenExpiresIn,
      }),
    ]);

    await this.storeRefreshToken(user.id, refreshToken, transaction);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
      refreshExpiresIn: this.refreshTokenExpiresIn,
    };
  }

  private resolveAccessRole(
    roles: Array<{ role: { name: string } }>,
  ): 'admin' | 'staff' | 'customer' {
    const roleNames = roles.map(({ role }) => role.name);

    if (roleNames.length === 0) {
      return 'customer';
    }

    if (roleNames.includes(UserRoleNames.ADMIN)) {
      return 'admin';
    }

    if (roleNames.includes(UserRoleNames.CUSTOMER) && roleNames.length === 1) {
      return 'customer';
    }

    return 'staff';
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    transaction?: Prisma.TransactionClient,
  ) {
    await (transaction ?? this.prisma).refreshToken.create({
      data: {
        userId,
        token: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTokenTtlMs),
      },
    });
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordFailedLoginAttempt(
    userId: string,
    currentFailedAttempts: number,
  ) {
    const nextFailedAttempts = currentFailedAttempts + 1;
    const shouldLock = nextFailedAttempts >= this.maxFailedAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: nextFailedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + this.lockoutDurationMs)
          : null,
      },
    });
  }

  private async resetFailedLoginState(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  private async ensureCustomerProfileAndClaimGuestOrders(
    userId: string,
    name: string,
    email: string,
  ) {
    const normalizedEmail = email.toLowerCase();

    await this.prisma.$transaction(async (transaction) => {
      const existingCustomer = await transaction.customer.findFirst({
        where: { userId },
        select: { id: true },
      });

      const customerId = existingCustomer
        ? existingCustomer.id
        : (
            await transaction.customer.create({
              data: {
                name,
                email: normalizedEmail,
                userId,
              },
              select: { id: true },
            })
          ).id;

      await transaction.order.updateMany({
        where: {
          customerId: null,
          guestEmail: normalizedEmail,
        },
        data: {
          customerId,
        },
      });
    });
  }

  private maskEmail(email: string) {
    const [localPart, domain] = email.split('@');

    if (!localPart || !domain) {
      return email;
    }

    const visiblePrefix = localPart.slice(0, 2);

    return `${visiblePrefix}${localPart.length > 2 ? '***' : ''}@${domain}`;
  }

  private normalizeDuration(
    duration: string | undefined,
    fallback: TokenDuration,
  ): TokenDuration {
    if (duration && /^(\d+)([smhd])$/.test(duration)) {
      return duration as TokenDuration;
    }

    return fallback;
  }

  private parseDurationMs(duration: TokenDuration): number {
    const match = /^(\d+)([smhd])$/.exec(duration);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }
}
