import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Request,
    Res,
    ParseFilePipe,
    MaxFileSizeValidator,
    Body,
    Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import * as express from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
    constructor(private readonly filesService: FilesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all files for current user with pagination' })
    async getMyFiles(
        @Request() req,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        return this.filesService.getUserFiles(req.user.userId, +page, +limit);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get file statistics for current user' })
    async getMyStats(@Request() req) {
        return this.filesService.getFileStats(req.user.userId);
    }

    @Post('upload')
    @ApiOperation({ summary: 'Upload a file' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @Request() req,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 * 1024 }), // 2GB max
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        return this.filesService.uploadFile(req.user.userId, file);
    }

    @Post('upload/session')
    @ApiOperation({ summary: 'Create a resumable upload session' })
    async createUploadSession(
        @Request() req,
        @Body() body: { fileName: string; size: number; mimeType: string },
    ) {
        const origin = req.headers.origin;
        return this.filesService.createUploadSession(
            req.user.userId,
            body.fileName,
            body.size,
            body.mimeType,
            origin,
        );
    }

    @Post('upload/complete')
    @ApiOperation({ summary: 'Complete a direct upload' })
    async completeUpload(
        @Request() req,
        @Body() body: { driveFileId: string; originalName: string; fileName: string; size: number; mimeType: string },
    ) {
        console.log(`[FilesController] Completing upload for user ${req.user.userId}:`, body);
        try {
            const result = await this.filesService.completeDirectUpload(
                req.user.userId,
                body.driveFileId,
                body.originalName,
                body.fileName,
                body.size,
                body.mimeType,
            );
            console.log(`[FilesController] Upload completed successfully for ${body.originalName}`);
            return result;
        } catch (error) {
            console.error(`[FilesController] Error completing upload for ${body.originalName}:`, error);
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get file info by ID' })
    async getFile(@Param('id') id: string, @Request() req) {
        return this.filesService.getFileById(id, req.user.userId);
    }

    @Get(':id/download')
    @ApiOperation({ summary: 'Download a file' })
    async downloadFile(
        @Param('id') id: string,
        @Request() req,
        @Res() res: any,
    ) {
        const { stream, mimeType, fileName } = await this.filesService.downloadFile(
            id,
            req.user.userId,
        );

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

        stream.pipe(res);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a file' })
    async deleteFile(@Param('id') id: string, @Request() req) {
        await this.filesService.deleteFile(id, req.user.userId);
        return { message: 'File deleted successfully' };
    }
}
