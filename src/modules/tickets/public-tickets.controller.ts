import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { TicketsService } from './tickets.service';

class CreatePublicTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @ApiProperty()
  @IsEmail()
  customerEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  content!: string;
}

@ApiTags('Store Support')
@Controller('store/support')
export class PublicTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a public customer support ticket' })
  @ApiCreatedResponse({ description: 'Created successfully' })
  async create(@Body() dto: CreatePublicTicketDto) {
    const ticket = await this.ticketsService.create({
      guestName: dto.customerName.trim(),
      guestEmail: dto.customerEmail.trim().toLowerCase(),
      subject: dto.subject.trim(),
      description: dto.content.trim(),
    });
    return { success: true, data: ticket };
  }
}
