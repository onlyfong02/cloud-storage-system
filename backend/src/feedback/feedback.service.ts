import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Feedback, FeedbackDocument } from './feedback.schema';

@Injectable()
export class FeedbackService {
    constructor(
        @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
    ) { }

    async create(userId: string, content: string): Promise<Feedback> {
        const feedback = new this.feedbackModel({
            user: userId,
            content,
        });
        return feedback.save();
    }

    async findAll(page: number = 1, limit: number = 10): Promise<{ feedbacks: Feedback[], total: number, totalPages: number }> {
        const skip = (page - 1) * limit;
        const [feedbacks, total] = await Promise.all([
            this.feedbackModel.find().populate('user', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.feedbackModel.countDocuments(),
        ]);
        return {
            feedbacks,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findByUser(userId: string, page: number = 1, limit: number = 10): Promise<{ feedbacks: Feedback[], total: number, totalPages: number }> {
        const skip = (page - 1) * limit;
        const [feedbacks, total] = await Promise.all([
            this.feedbackModel.find({ user: userId as any }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.feedbackModel.countDocuments({ user: userId as any }),
        ]);
        return {
            feedbacks,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }

    async reply(feedbackId: string, response: string): Promise<Feedback> {
        const feedback = await this.feedbackModel.findById(feedbackId);
        if (!feedback) {
            throw new NotFoundException('Feedback not found');
        }

        feedback.reply = response;
        feedback.isReplied = true;
        return feedback.save();
    }
}
