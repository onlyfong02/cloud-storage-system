import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type FileMetadataDocument = FileMetadata & Document;

@Schema({ timestamps: true })
export class FileMetadata {
    @Prop({ required: true })
    driveFileId: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    ownerId: Types.ObjectId;

    @Prop({ required: true })
    originalName: string;

    @Prop({ required: true })
    fileName: string;

    @Prop({ required: true })
    size: number;

    @Prop({ required: true })
    mimeType: string;

    @Prop()
    thumbnailLink?: string;

    @Prop()
    webViewLink?: string;

    @Prop({ type: Types.ObjectId, ref: 'FileMetadata', default: null })
    parentId?: Types.ObjectId;
}

export const FileMetadataSchema = SchemaFactory.createForClass(FileMetadata);

FileMetadataSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

FileMetadataSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret: any) {
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

FileMetadataSchema.set('toObject', {
    virtuals: true,
});
