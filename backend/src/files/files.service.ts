import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, FileMetadataDocument } from './schemas/file.schema';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);

    constructor(
        @InjectModel(FileMetadata.name) private fileModel: Model<FileMetadataDocument>,
        private googleDriveService: GoogleDriveService,
        private usersService: UsersService,
    ) { }

    async uploadFile(userId: string, file: Express.Multer.File): Promise<FileMetadataDocument> {
        // Check if Google Drive is initialized
        if (!this.googleDriveService.isInitialized()) {
            throw new BadRequestException('Google Drive service is not configured');
        }

        // Check quota
        const user = await this.usersService.findById(userId);
        const hasQuota = await this.usersService.checkQuota(userId, file.size);

        if (!hasQuota) {
            throw new BadRequestException(
                `Insufficient storage quota. Available: ${this.formatBytes(user.maxStorage - user.usedStorage)}, Required: ${this.formatBytes(file.size)}`,
            );
        }

        // Get or create user folder
        let folderId = user.driveFolderId;
        if (!folderId) {
            folderId = await this.googleDriveService.createUserFolder(userId, user.email);
            await this.usersService.updateDriveFolderId(userId, folderId);
        }

        // Generate unique filename
        const fileExtension = file.originalname.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;

        // Upload to Google Drive
        const driveFile = await this.googleDriveService.uploadFile(file, folderId, uniqueFileName);

        // Save metadata to database
        const fileMetadata = new this.fileModel({
            driveFileId: driveFile.id,
            ownerId: new Types.ObjectId(userId),
            originalName: file.originalname,
            fileName: uniqueFileName,
            size: file.size,
            mimeType: file.mimetype,
            thumbnailLink: driveFile['thumbnailLink'],
            webViewLink: driveFile['webViewLink'],
        });

        const savedFile = await fileMetadata.save();

        // Update user's used storage
        await this.usersService.updateUsedStorage(userId, file.size);

        this.logger.log(`File uploaded: ${file.originalname} for user ${userId}`);

        return savedFile;
    }

    async createUploadSession(
        userId: string,
        fileName: string,
        size: number,
        mimeType: string,
        origin?: string,
    ): Promise<{ sessionUrl: string; uniqueFileName: string }> {
        if (!this.googleDriveService.isInitialized()) {
            throw new BadRequestException('Google Drive service is not configured');
        }

        const user = await this.usersService.findById(userId);
        const hasQuota = await this.usersService.checkQuota(userId, size);

        if (!hasQuota) {
            throw new BadRequestException(
                `Insufficient storage quota. Required: ${this.formatBytes(size)}`,
            );
        }

        let folderId = user.driveFolderId;
        if (!folderId) {
            folderId = await this.googleDriveService.createUserFolder(userId, user.email);
            await this.usersService.updateDriveFolderId(userId, folderId);
        }

        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;

        const sessionUrl = await this.googleDriveService.initiateResumableUpload(
            folderId,
            uniqueFileName,
            mimeType,
            size,
            origin,
        );

        return { sessionUrl, uniqueFileName };
    }

    async completeDirectUpload(
        userId: string,
        driveFileId: string,
        originalName: string,
        fileName: string,
        size: number,
        mimeType: string,
    ): Promise<FileMetadataDocument> {
        this.logger.log(`[FilesService] Starting completeDirectUpload for user: ${userId}, file: ${originalName}, driveId: ${driveFileId}`);

        if (!driveFileId) {
            throw new BadRequestException('driveFileId is required');
        }

        try {
            // Double check the file exists on Drive
            this.logger.log(`[FilesService] Verifying file on Google Drive: ${driveFileId}`);
            const driveFile = await this.googleDriveService.getFileInfo(driveFileId);
            if (!driveFile) {
                this.logger.error(`[FilesService] File not found on Google Drive: ${driveFileId}`);
                throw new NotFoundException('File not found on Google Drive');
            }

            this.logger.log(`[FilesService] File verified on Drive: ${driveFile.name} (Size: ${driveFile.size})`);

            const fileMetadata = new this.fileModel({
                driveFileId: driveFile.id,
                ownerId: new Types.ObjectId(userId),
                originalName,
                fileName,
                size,
                mimeType,
                thumbnailLink: driveFile.thumbnailLink,
                webViewLink: driveFile.webViewLink,
            });

            this.logger.log(`[FilesService] Saving file metadata to database...`);
            const savedFile = await fileMetadata.save();

            this.logger.log(`[FilesService] Updating user storage quota for user: ${userId}`);
            await this.usersService.updateUsedStorage(userId, size);

            this.logger.log(`[FilesService] Direct upload completed and saved: ${originalName}`);
            return savedFile;
        } catch (error) {
            this.logger.error(`[FilesService] Failed to complete direct upload for file: ${originalName}`, error.stack);
            throw error;
        }
    }

    async getUserFiles(userId: string, page: number = 1, limit: number = 10): Promise<{ files: FileMetadataDocument[]; total: number }> {
        const skip = (page - 1) * limit;
        const [files, total] = await Promise.all([
            this.fileModel
                .find({ ownerId: new Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.fileModel.countDocuments({ ownerId: new Types.ObjectId(userId) }),
        ]);

        return { files, total };
    }

    async getFileStats(userId: string): Promise<{
        total: number;
        images: number;
        imagesSize: number;
        videos: number;
        videosSize: number;
        audios: number;
        audiosSize: number;
        documents: number;
        documentsSize: number;
        others: number;
        othersSize: number;
    }> {
        const stats = await this.fileModel.aggregate([
            { $match: { ownerId: new Types.ObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    images: {
                        $sum: {
                            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^image\// } }, 1, 0],
                        },
                    },
                    imagesSize: {
                        $sum: {
                            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^image\// } }, '$size', 0],
                        },
                    },
                    videos: {
                        $sum: {
                            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^video\// } }, 1, 0],
                        },
                    },
                    videosSize: {
                        $sum: {
                            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^video\// } }, '$size', 0],
                        },
                    },
                    audios: {
                        $sum: {
                            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^audio\// } }, 1, 0],
                        },
                    },
                    audiosSize: {
                        $sum: {
                            $cond: [{ $regexMatch: { input: '$mimeType', regex: /^audio\// } }, '$size', 0],
                        },
                    },
                    documents: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $regexMatch: { input: '$mimeType', regex: /\/pdf$/ } },
                                        { $regexMatch: { input: '$mimeType', regex: /\/msword$/ } },
                                        { $regexMatch: { input: '$mimeType', regex: /\/vnd\.openxmlformats-officedocument/ } },
                                        { $regexMatch: { input: '$mimeType', regex: /^text\// } },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    documentsSize: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $regexMatch: { input: '$mimeType', regex: /\/pdf$/ } },
                                        { $regexMatch: { input: '$mimeType', regex: /\/msword$/ } },
                                        { $regexMatch: { input: '$mimeType', regex: /\/vnd\.openxmlformats-officedocument/ } },
                                        { $regexMatch: { input: '$mimeType', regex: /^text\// } },
                                    ],
                                },
                                '$size',
                                0,
                            ],
                        },
                    },
                    totalSize: { $sum: '$size' },
                },
            },
        ]);

        if (stats.length === 0) {
            return {
                total: 0,
                images: 0,
                imagesSize: 0,
                videos: 0,
                videosSize: 0,
                audios: 0,
                audiosSize: 0,
                documents: 0,
                documentsSize: 0,
                others: 0,
                othersSize: 0,
            };
        }

        const result = stats[0];
        const others =
            result.total - (result.images + result.videos + result.audios + result.documents);
        const othersSize =
            result.totalSize -
            (result.imagesSize + result.videosSize + result.audiosSize + result.documentsSize);

        return {
            total: result.total,
            images: result.images,
            imagesSize: result.imagesSize,
            videos: result.videos,
            videosSize: result.videosSize,
            audios: result.audios,
            audiosSize: result.audiosSize,
            documents: result.documents,
            documentsSize: result.documentsSize,
            others: others > 0 ? others : 0,
            othersSize: othersSize > 0 ? othersSize : 0,
        };
    }

    async getFileById(fileId: string, userId: string): Promise<FileMetadataDocument> {
        const file = await this.fileModel.findById(fileId);

        if (!file) {
            throw new NotFoundException('File not found');
        }

        if (file.ownerId.toString() !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return file;
    }

    async downloadFile(fileId: string, userId: string) {
        const file = await this.getFileById(fileId, userId);

        const driveFile = await this.googleDriveService.downloadFile(file.driveFileId);

        return {
            stream: driveFile.stream,
            mimeType: file.mimeType,
            fileName: file.originalName,
        };
    }

    async deleteFile(fileId: string, userId: string): Promise<void> {
        const file = await this.getFileById(fileId, userId);

        // Delete from Google Drive
        await this.googleDriveService.deleteFile(file.driveFileId);

        // Update user's used storage
        await this.usersService.updateUsedStorage(userId, -file.size);

        // Delete metadata from database
        await this.fileModel.findByIdAndDelete(fileId);

        this.logger.log(`File deleted: ${file.originalName} for user ${userId}`);
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
