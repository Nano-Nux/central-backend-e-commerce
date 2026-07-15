import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { UsersService } from '../users/users.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @ApiAcceptedResponse({
    description: 'Registration request received.',
    type: ApiSuccessResponseDto,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() request: Request) {
    await this.authService.register(registerDto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Registration request received.',
    };
  }

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() request: Request) {
    const data = await this.authService.login(loginDto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Logged in successfully',
      data,
    };
  }

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('refresh')
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
  ) {
    const data = await this.authService.refresh(refreshTokenDto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiAcceptedResponse({
    description: 'Success',
    type: ApiSuccessResponseDto,
  })
  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    return {
      success: true,
      message: 'Success',
      data: await this.usersService.findMe(request.user.id),
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Body() logoutDto: LogoutDto,
  ) {
    const data = await this.authService.logout(
      request.user.id,
      logoutDto.refreshToken,
      {
        actorId: request.user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );

    return {
      success: true,
      message: 'Logged out successfully',
      data,
    };
  }
}
