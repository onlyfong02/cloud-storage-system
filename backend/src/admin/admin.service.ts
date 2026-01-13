import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import { FileMetadata, FileMetadataDocument } from '../files/schemas/file.schema';
import { UpdateUserStatusDto, UpdateUserQuotaDto } from '../users/dto';

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(FileMetadata.name) private fileModel: Model<FileMetadataDocument>,
    ) { }

    async getAllUsers(page: number, limit: number, search?: string) {
        const skip = (page - 1) * limit;

        let query = {};
        if (search) {
            query = {
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                ],
            };
        }

        const [users, total] = await Promise.all([
            this.userModel
                .find(query)
                .select('-password -refreshToken')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .exec(),
            this.userModel.countDocuments(query),
        ]);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getUserById(id: string) {
        const user = await this.userModel.findById(id).select('-password -refreshToken');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const filesCount = await this.fileModel.countDocuments({ ownerId: user._id });

        return {
            ...user.toObject(),
            filesCount,
        };
    }

    async updateUserStatus(id: string, updateStatusDto: UpdateUserStatusDto) {
        const user = await this.userModel
            .findByIdAndUpdate(id, { status: updateStatusDto.status }, { new: true })
            .select('-password -refreshToken');

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async updateUserQuota(id: string, updateQuotaDto: UpdateUserQuotaDto) {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (updateQuotaDto.maxStorage < user.usedStorage) {
            throw new BadRequestException(
                `Cannot set quota below used storage. Current usage: ${this.formatBytes(user.usedStorage)}`,
            );
        }

        user.maxStorage = updateQuotaDto.maxStorage;
        await user.save();

        return this.userModel.findById(id).select('-password -refreshToken');
    }

    async getSystemStats() {
        const [totalUsers, activeUsers, inactiveUsers, totalFiles] = await Promise.all([
            this.userModel.countDocuments(),
            this.userModel.countDocuments({ status: UserStatus.ACTIVE }),
            this.userModel.countDocuments({ status: UserStatus.INACTIVE }),
            this.fileModel.countDocuments(),
        ]);

        const storageStats = await this.userModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalAllocated: { $sum: '$maxStorage' },
                    totalUsed: { $sum: '$usedStorage' },
                },
            },
        ]);

        return {
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: inactiveUsers,
            },
            files: {
                total: totalFiles,
            },
            storage: {
                totalAllocated: storageStats[0]?.totalAllocated || 0,
                totalUsed: storageStats[0]?.totalUsed || 0,
                totalAllocatedFormatted: this.formatBytes(storageStats[0]?.totalAllocated || 0),
                totalUsedFormatted: this.formatBytes(storageStats[0]?.totalUsed || 0),
            },
        };
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
