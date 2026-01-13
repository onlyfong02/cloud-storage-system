import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserStatus } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto, UpdateUserQuotaDto } from './dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private configService: ConfigService,
    ) { }

    async create(createUserDto: CreateUserDto): Promise<UserDocument> {
        const existingUser = await this.userModel.findOne({ email: createUserDto.email });
        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        const defaultQuota = this.configService.get<number>('DEFAULT_USER_QUOTA') || 1073741824;

        const user = new this.userModel({
            ...createUserDto,
            password: hashedPassword,
            maxStorage: defaultQuota,
        });

        return user.save();
    }

    async findAll(): Promise<UserDocument[]> {
        return this.userModel.find().select('-password -refreshToken').exec();
    }

    async findById(id: string): Promise<UserDocument> {
        const user = await this.userModel.findById(id).select('-password -refreshToken');
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email }).exec();
    }

    async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email }).exec();
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<UserDocument> {
        const user = await this.userModel
            .findByIdAndUpdate(id, updateUserDto, { new: true })
            .select('-password -refreshToken');

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async updateStatus(id: string, updateStatusDto: UpdateUserStatusDto): Promise<UserDocument> {
        const user = await this.userModel
            .findByIdAndUpdate(id, { status: updateStatusDto.status }, { new: true })
            .select('-password -refreshToken');

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async updateQuota(id: string, updateQuotaDto: UpdateUserQuotaDto): Promise<UserDocument> {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        user.maxStorage = updateQuotaDto.maxStorage;
        await user.save();

        return this.userModel.findById(id).select('-password -refreshToken');
    }

    async updateUsedStorage(id: string, sizeDelta: number): Promise<UserDocument> {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        user.usedStorage = Math.max(0, user.usedStorage + sizeDelta);
        await user.save();

        return user;
    }

    async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
        await this.userModel.findByIdAndUpdate(id, { refreshToken });
    }

    async updateDriveFolderId(id: string, driveFolderId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(id, { driveFolderId });
    }

    async validatePassword(user: UserDocument, password: string): Promise<boolean> {
        return bcrypt.compare(password, user.password);
    }

    async checkQuota(userId: string, fileSize: number): Promise<boolean> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user.usedStorage + fileSize <= user.maxStorage;
    }

    async isActive(userId: string): Promise<boolean> {
        const user = await this.userModel.findById(userId);
        return user?.status === UserStatus.ACTIVE;
    }
}
