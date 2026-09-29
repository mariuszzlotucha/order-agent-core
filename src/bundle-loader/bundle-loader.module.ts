import { Module } from '@nestjs/common';
import { BundleLoaderService } from './bundle-loader.service';

@Module({
  providers: [BundleLoaderService],
  exports: [BundleLoaderService],
})
export class BundleLoaderModule {}
