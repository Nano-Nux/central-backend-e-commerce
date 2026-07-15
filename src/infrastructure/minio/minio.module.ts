import { Module } from '@nestjs/common';

import { AuthModule } from '../../modules/auth/auth.module';
import { FileController } from './file.controller';
import { MinioService } from './minio.service';

@Module({
  imports: [AuthModule],
  controllers: [FileController],
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
