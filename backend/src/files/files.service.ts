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
import { Readable } from 'stream';
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

    async uploadFile(userId: string, file: Express.Multer.File, parentId?: string): Promise<FileMetadataDocument> {
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

        // Determine destination folder ID on Google Drive
        let destinationDriveFolderId: string;
        if (parentId) {
            const parentFolder = await this.fileModel.findById(parentId);
            if (!parentFolder || parentFolder.ownerId.toString() !== userId) {
                throw new NotFoundException('Parent folder not found');
            }
            destinationDriveFolderId = parentFolder.driveFileId;
        } else {
            // Get or create user root folder if not exists
            let rootFolderId = user.driveFolderId;
            if (!rootFolderId) {
                rootFolderId = await this.googleDriveService.createUserFolder(userId, user.email);
                await this.usersService.updateDriveFolderId(userId, rootFolderId);
            }
            destinationDriveFolderId = rootFolderId;
        }

        // Generate unique filename
        const fileExtension = file.originalname.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;

        // Upload to Google Drive
        const driveFile = await this.googleDriveService.uploadFile(file, destinationDriveFolderId, uniqueFileName);

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
            parentId: parentId ? new Types.ObjectId(parentId) : null,
        });

        const savedFile = await fileMetadata.save();

        // Update user's used storage
        await this.usersService.updateUsedStorage(userId, file.size);

        this.logger.log(`File uploaded: ${file.originalname} (Parent: ${parentId || 'root'}) for user ${userId}`);

        return savedFile;
    }

    async createUploadSession(
        userId: string,
        fileName: string,
        size: number,
        mimeType: string,
        origin?: string,
        parentId?: string,
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

        // Determine destination folder ID on Google Drive
        let destinationDriveFolderId: string;
        if (parentId) {
            const parentFolder = await this.fileModel.findById(parentId);
            if (!parentFolder || parentFolder.ownerId.toString() !== userId) {
                throw new NotFoundException('Parent folder not found');
            }
            destinationDriveFolderId = parentFolder.driveFileId;
        } else {
            // Get or create user root folder if not exists
            let rootFolderId = user.driveFolderId;
            if (!rootFolderId) {
                rootFolderId = await this.googleDriveService.createUserFolder(userId, user.email);
                await this.usersService.updateDriveFolderId(userId, rootFolderId);
            }
            destinationDriveFolderId = rootFolderId;
        }

        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;

        const sessionUrl = await this.googleDriveService.initiateResumableUpload(
            destinationDriveFolderId,
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
        parentId?: string,
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
                parentId: parentId ? new Types.ObjectId(parentId) : null,
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

    async createFolder(userId: string, folderName: string, parentId?: string): Promise<FileMetadataDocument> {
        if (!this.googleDriveService.isInitialized()) {
            throw new BadRequestException('Google Drive service is not configured');
        }

        const user = await this.usersService.findById(userId);

        // Determine destination folder ID on Google Drive
        let destinationDriveFolderId: string;
        if (parentId) {
            const parentFolder = await this.fileModel.findById(parentId);
            if (!parentFolder || parentFolder.ownerId.toString() !== userId) {
                throw new NotFoundException('Parent folder not found');
            }
            destinationDriveFolderId = parentFolder.driveFileId;
        } else {
            // Get or create user root folder if not exists
            let rootFolderId = user.driveFolderId;
            if (!rootFolderId) {
                rootFolderId = await this.googleDriveService.createUserFolder(userId, user.email);
                await this.usersService.updateDriveFolderId(userId, rootFolderId);
            }
            destinationDriveFolderId = rootFolderId;
        }

        // Create folder on Google Drive
        const driveFolder = await this.googleDriveService.createFolder(folderName, destinationDriveFolderId);

        // Save metadata to database
        const folderMetadata = new this.fileModel({
            driveFileId: driveFolder.id,
            ownerId: new Types.ObjectId(userId),
            originalName: folderName,
            fileName: folderName,
            size: 0,
            mimeType: 'application/vnd.google-apps.folder',
            parentId: parentId ? new Types.ObjectId(parentId) : null,
        });

        const savedFolder = await folderMetadata.save();

        this.logger.log(`Folder created: ${folderName} (Parent: ${parentId || 'root'}) for user ${userId}`);

        return savedFolder;
    }

    async getUserFiles(
        userId: string,
        page: number = 1,
        limit: number = 10,
        parentId?: string,
    ): Promise<{ files: FileMetadataDocument[]; total: number }> {
        const skip = (page - 1) * limit;

        const query: any = { ownerId: new Types.ObjectId(userId) };

        if (parentId) {
            query.parentId = new Types.ObjectId(parentId);
        } else {
            query.parentId = { $in: [null, undefined] }; // Files in the root
        }

        const [files, total] = await Promise.all([
            this.fileModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.fileModel.countDocuments(query),
        ]);

        return { files, total };
    }

    async getFileStream(fileId: string, userId: string): Promise<{ stream: Readable; mimeType: string }> {
        const file = await this.getFileById(fileId, userId);
        return this.googleDriveService.getFileStream(file.driveFileId);
    }

    async getThumbnail(fileId: string, userId: string): Promise<{ stream: Readable; mimeType: string }> {
        const file = await this.getFileById(fileId, userId);
        return this.googleDriveService.getThumbnail(file.driveFileId);
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
            {
                $match: {
                    ownerId: new Types.ObjectId(userId),
                    mimeType: { $ne: 'application/vnd.google-apps.folder' },
                },
            },
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

    async shareRootFolder(userId: string, email: string): Promise<void> {
        const user = await this.usersService.findById(userId);
        if (!user || !user.driveFolderId) {
            throw new BadRequestException('User root folder not found');
        }

        await this.googleDriveService.shareFile(user.driveFolderId, email, 'reader');
        this.logger.log(`Shared root folder of user ${userId} with ${email}`);
    }

    async getRootFolderPermissions(userId: string): Promise<any[]> {
        const user = await this.usersService.findById(userId);
        if (!user || !user.driveFolderId) {
            throw new BadRequestException('User root folder not found');
        }

        return this.googleDriveService.getPermissions(user.driveFolderId);
    }

    async removeRootFolderPermission(userId: string, permissionId: string): Promise<void> {
        const user = await this.usersService.findById(userId);
        if (!user || !user.driveFolderId) {
            throw new BadRequestException('User root folder not found');
        }

        await this.googleDriveService.removePermission(user.driveFolderId, permissionId);
    }

    async removeUserRootFolderPermission(ownerId: string, permissionId: string): Promise<void> {
        const user = await this.usersService.findById(ownerId);
        if (!user || !user.driveFolderId) {
            throw new BadRequestException('User root folder not found');
        }

        await this.googleDriveService.removePermission(user.driveFolderId, permissionId);
    }

    async getAllSharedPermissions(): Promise<any[]> {
        const users = await this.usersService.findAll();
        const allPermissions: any[] = [];

        for (const user of users) {
            if (user.driveFolderId) {
                try {
                    const permissions = await this.googleDriveService.getPermissions(user.driveFolderId);
                    const sharedPermissions = permissions.filter(p => p.role !== 'owner'); // Exclude owner

                    if (sharedPermissions.length > 0) {
                        allPermissions.push(...sharedPermissions.map(p => ({
                            permissionId: p.id,
                            email: p.emailAddress,
                            role: p.role,
                            owner: {
                                id: user._id,
                                name: user.name,
                                email: user.email,
                                driveFolderId: user.driveFolderId
                            }
                        })));
                    }
                } catch (error) {
                    this.logger.warn(`Failed to fetch permissions for user ${user.email}: ${error.message}`);
                    // Continue to next user
                }
            }
        }

        return allPermissions;
    }

    async deleteFile(fileId: string, userId: string): Promise<void> {
        const file = await this.getFileById(fileId, userId);

        if (file.mimeType === 'application/vnd.google-apps.folder') {
            await this.deleteFolderRecursive(file, userId);
        } else {
            // Delete from Google Drive
            await this.googleDriveService.deleteFile(file.driveFileId);

            // Update user's used storage
            await this.usersService.updateUsedStorage(userId, -file.size);

            // Delete metadata from database
            await this.fileModel.findByIdAndDelete(fileId);
        }

        this.logger.log(`File deleted: ${file.originalName} for user ${userId}`);
    }

    private async deleteFolderRecursive(folder: FileMetadataDocument, userId: string): Promise<void> {
        // Find all children
        const children = await this.fileModel.find({ parentId: folder._id });

        for (const child of children) {
            if (child.mimeType === 'application/vnd.google-apps.folder') {
                await this.deleteFolderRecursive(child, userId);
            } else {
                // Delete child file from Google Drive
                await this.googleDriveService.deleteFile(child.driveFileId);
                // Update storage for child file
                await this.usersService.updateUsedStorage(userId, -child.size);
                // Delete child metadata
                await this.fileModel.findByIdAndDelete(child._id);
            }
        }

        // After deleting all children, delete the folder itself
        await this.googleDriveService.deleteFile(folder.driveFileId);
        await this.fileModel.findByIdAndDelete(folder._id);
    }

    async moveFile(userId: string, fileId: string, targetFolderId?: string): Promise<FileMetadataDocument> {
        const file = await this.getFileById(fileId, userId);

        let targetDriveFolderId: string;
        let oldParentDriveFolderId: string;

        // Get current parent drive folder ID
        if (file.parentId) {
            const oldParent = await this.fileModel.findById(file.parentId);
            if (!oldParent) {
                throw new NotFoundException('Current parent folder not found');
            }
            oldParentDriveFolderId = oldParent.driveFileId;
        } else {
            const user = await this.usersService.findById(userId);
            oldParentDriveFolderId = user.driveFolderId;
        }

        // Get target drive folder ID
        if (targetFolderId) {
            if (targetFolderId === file._id.toString()) {
                throw new BadRequestException('Cannot move a folder into itself');
            }
            const targetFolder = await this.fileModel.findById(targetFolderId);
            if (!targetFolder || targetFolder.mimeType !== 'application/vnd.google-apps.folder') {
                throw new BadRequestException('Target is not a valid folder');
            }
            targetDriveFolderId = targetFolder.driveFileId;
        } else {
            const user = await this.usersService.findById(userId);
            targetDriveFolderId = user.driveFolderId;
        }

        // Move on Google Drive
        await this.googleDriveService.moveFile(file.driveFileId, oldParentDriveFolderId, targetDriveFolderId);

        // Update database
        file.parentId = targetFolderId ? new Types.ObjectId(targetFolderId) : undefined;
        const updatedFile = await file.save();

        this.logger.log(`File ${file.originalName} moved to ${targetFolderId || 'root'} by user ${userId}`);

        return updatedFile;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
