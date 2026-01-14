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
    BadRequestException,
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
        @Query('parentId') parentId?: string,
    ) {
        return this.filesService.getUserFiles(req.user.userId, +page, +limit, parentId);
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
                parentId: {
                    type: 'string',
                    required: ['false'],
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
        @Body('parentId') parentId?: string,
    ) {
        return this.filesService.uploadFile(req.user.userId, file, parentId);
    }

    @Post('upload/session')
    @ApiOperation({ summary: 'Create a resumable upload session' })
    async createUploadSession(
        @Request() req,
        @Body() body: { fileName: string; size: number; mimeType: string; parentId?: string },
    ) {
        const origin = req.headers.origin;
        return this.filesService.createUploadSession(
            req.user.userId,
            body.fileName,
            body.size,
            body.mimeType,
            origin,
            body.parentId,
        );
    }

    @Post('upload/complete')
    @ApiOperation({ summary: 'Complete a direct upload' })
    async completeUpload(
        @Request() req,
        @Body() body: { driveFileId: string; originalName: string; fileName: string; size: number; mimeType: string; parentId?: string },
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
                body.parentId,
            );
            console.log(`[FilesController] Upload completed successfully for ${body.originalName}`);
            return result;
        } catch (error) {
            console.error(`[FilesController] Error completing upload for ${body.originalName}:`, error);
            throw error;
        }
    }

    @Post('folder')
    @ApiOperation({ summary: 'Create a new folder' })
    async createFolder(
        @Request() req,
        @Body() body: { name: string; parentId?: string },
    ) {
        return this.filesService.createFolder(req.user.userId, body.name, body.parentId);
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

    @Get(':id/view')
    @ApiOperation({ summary: 'View/Stream a file directly' })
    async viewFile(
        @Param('id') id: string,
        @Request() req,
        @Res() res: any,
    ) {
        const { stream, mimeType } = await this.filesService.getFileStream(
            id,
            req.user.userId,
        );

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', 'inline');

        stream.pipe(res);
    }

    @Get(':id/thumbnail')
    @ApiOperation({ summary: 'Get file thumbnail proxy' })
    async getThumbnail(
        @Param('id') id: string,
        @Request() req,
        @Res() res: any,
    ) {
        try {
            const { stream, mimeType } = await this.filesService.getThumbnail(
                id,
                req.user.userId,
            );

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', 'inline');

            stream.pipe(res);
        } catch (error) {
            // If thumbnail fails, return 404
            res.status(404).send('Thumbnail not found');
        }
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a file' })
    async deleteFile(@Param('id') id: string, @Request() req) {
        await this.filesService.deleteFile(id, req.user.userId);
        return { message: 'File deleted successfully' };
    }

    @Post('share')
    @ApiOperation({ summary: 'Share root folder with an email' })
    async shareRootFolder(@Request() req, @Body() body: { email: string }) {
        if (!body.email) {
            throw new BadRequestException('Email is required');
        }
        await this.filesService.shareRootFolder(req.user.userId, body.email);
        return { message: `Folder shared with ${body.email} successfully` };
    }

    @Get('admin/permissions/all')
    @ApiOperation({ summary: 'Get all shared permissions (Admin only)' })
    async getAllSharedPermissions(@Request() req) {
        if (req.user.role !== 'ADMIN') {
            throw new BadRequestException('Access denied');
        }
        return this.filesService.getAllSharedPermissions();
    }

    @Delete('admin/permissions/:ownerId/:permissionId')
    @ApiOperation({ summary: 'Remove a shared permission (Admin only)' })
    async removeAdminSharedPermission(
        @Request() req,
        @Param('ownerId') ownerId: string,
        @Param('permissionId') permissionId: string
    ) {
        if (req.user.role !== 'ADMIN') {
            throw new BadRequestException('Access denied');
        }
        await this.filesService.removeUserRootFolderPermission(ownerId, permissionId);
        return { message: 'Permission removed successfully' };
    }

    @Get('share/permissions')
    @ApiOperation({ summary: 'Get root folder permissions' })
    async getRootFolderPermissions(@Request() req) {
        return this.filesService.getRootFolderPermissions(req.user.userId);
    }

    @Delete('share/permissions/:permissionId')
    @ApiOperation({ summary: 'Remove a root folder permission' })
    async removeRootFolderPermission(@Request() req, @Param('permissionId') permissionId: string) {
        await this.filesService.removeRootFolderPermission(req.user.userId, permissionId);
        return { message: 'Permission removed successfully' };
    }

    @Post(':id/move')
    @ApiOperation({ summary: 'Move a file or folder' })
    async moveFile(
        @Param('id') id: string,
        @Request() req,
        @Body() body: { targetFolderId?: string },
    ) {
        return this.filesService.moveFile(req.user.userId, id, body.targetFolderId);
    }
}
