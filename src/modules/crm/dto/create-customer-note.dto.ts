import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateCustomerNoteDto {
  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty()
  @IsUUID()
  createdBy!: string;
}
