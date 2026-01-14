import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';

export type FeedbackDocument = Feedback & Document;

@Schema({ timestamps: true })
export class Feedback {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    user: User;

    @Prop({ required: true })
    content: string;

    @Prop()
    reply: string;

    @Prop({ default: false })
    isReplied: boolean;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
