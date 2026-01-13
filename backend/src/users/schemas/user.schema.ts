import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
}

export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop({ required: true })
    name: string;

    @Prop({ type: String, enum: UserRole, default: UserRole.USER })
    role: UserRole;

    @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
    status: UserStatus;

    @Prop({ default: 1073741824 }) // 1GB default
    maxStorage: number;

    @Prop({ default: 0 })
    usedStorage: number;

    @Prop()
    driveFolderId: string;

    @Prop()
    refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

UserSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

UserSchema.set('toObject', {
    virtuals: true,
});
