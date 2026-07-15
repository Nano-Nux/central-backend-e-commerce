import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UserStatus } from '../../../../generated/prisma/enums';
import { UsersService } from '../../users/users.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role?: 'admin' | 'staff' | 'customer';
};

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: string[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdForAuth(payload.sub);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid access token');
    }

    const safeUser = this.usersService.toAuthResponse(user);

    return {
      ...safeUser,
      roles: safeUser.roles.map((role) => role.name),
    };
  }
}
