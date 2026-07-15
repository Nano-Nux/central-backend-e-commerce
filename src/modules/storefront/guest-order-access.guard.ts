import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { StoreGuestOrdersService } from './store-guest-orders.service';

type GuestRequest = Request & {
  guestEmail?: string;
  guestAccessToken?: string;
};

@Injectable()
export class GuestOrderAccessGuard implements CanActivate {
  constructor(
    private readonly storeGuestOrdersService: StoreGuestOrdersService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<GuestRequest>();
    const queryToken =
      typeof request.query.guestAccessToken === 'string'
        ? request.query.guestAccessToken
        : typeof request.query.accessToken === 'string'
          ? request.query.accessToken
          : undefined;

    if (queryToken) {
      throw new UnauthorizedException(
        'Guest access tokens in URLs are not supported',
      );
    }

    const token =
      request.header('x-guest-access-token') ??
      this.tokenFromAuthorizationHeader(request);

    if (!token) {
      throw new UnauthorizedException('Guest access token is required');
    }

    const session =
      await this.storeGuestOrdersService.validateGuestAccessToken(token);

    request.guestEmail = session.email;
    request.guestAccessToken = token;

    return true;
  }

  private tokenFromAuthorizationHeader(request: Request) {
    const authorization = request.header('authorization')?.trim();

    if (!authorization) {
      return undefined;
    }

    const guestPrefix = 'Guest ';

    if (!authorization.startsWith(guestPrefix)) {
      return undefined;
    }

    const token = authorization.slice(guestPrefix.length).trim();

    return token || undefined;
  }
}
