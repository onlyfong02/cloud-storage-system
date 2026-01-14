import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Request,
    BadRequestException,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
    constructor(private readonly feedbackService: FeedbackService) { }

    @Post()
    @ApiOperation({ summary: 'Submit feedback' })
    async create(@Request() req, @Body() body: { content: string }) {
        if (!body.content) {
            throw new BadRequestException('Content is required');
        }
        return this.feedbackService.create(req.user.userId, body.content);
    }

    @Get()
    @ApiOperation({ summary: 'Get my feedback' })
    async getMyFeedback(
        @Request() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.feedbackService.findByUser(req.user.userId, Number(page), Number(limit));
    }

    @Get('all')
    @ApiOperation({ summary: 'Get all feedback (Admin only)' })
    async getAllFeedback(
        @Request() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        if (req.user.role !== 'ADMIN') {
            throw new BadRequestException('Access denied');
        }
        return this.feedbackService.findAll(Number(page), Number(limit));
    }

    @Post(':id/reply')
    @ApiOperation({ summary: 'Reply to feedback (Admin only)' })
    async reply(
        @Request() req,
        @Param('id') id: string,
        @Body() body: { response: string },
    ) {
        if (req.user.role !== 'ADMIN') {
            throw new BadRequestException('Access denied');
        }
        if (!body.response) {
            throw new BadRequestException('Response is required');
        }
        return this.feedbackService.reply(id, body.response);
    }
}
