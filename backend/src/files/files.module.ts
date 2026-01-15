import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { SignedFilesController } from './signed-files.controller';
import { FileMetadata, FileMetadataSchema } from './schemas/file.schema';
import { UsersModule } from '../users/users.module';
import { SignedUrlService } from './signed-url.service';
import { GoogleDriveModule } from '../google-drive/google-drive.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: FileMetadata.name, schema: FileMetadataSchema }]),
        MulterModule.register({
            storage: memoryStorage(),
        }),
        UsersModule,
        GoogleDriveModule,
    ],
    controllers: [FilesController, SignedFilesController],
    providers: [FilesService, SignedUrlService],
    exports: [FilesService, SignedUrlService],
})
export class FilesModule { }

