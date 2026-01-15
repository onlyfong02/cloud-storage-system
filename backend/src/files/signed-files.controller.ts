import {
    Controller,
    Get,
    Param,
    Query,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { SignedUrlService } from './signed-url.service';

/**
 * Public controller for signed URL file access
 * These endpoints do NOT require JWT authentication
 * Instead, they validate the signed URL parameters
 */
@ApiTags('files')
@Controller('files')
export class SignedFilesController {
    constructor(
        private readonly filesService: FilesService,
        private readonly signedUrlService: SignedUrlService,
    ) { }

    @Get(':id/signed-view')
    @ApiOperation({ summary: 'View a file using signed URL (no auth required)' })
    async signedViewFile(
        @Param('id') id: string,
        @Query('userId') userId: string,
        @Query('expires') expires: string,
        @Query('signature') signature: string,
        @Res() res: any,
    ) {
        // Validate signed params
        this.validateSignedParams(id, userId, expires, signature);

        // Get file stream
        const { stream, mimeType, size } = await this.filesService.getFileStream(
            id,
            userId,
        );

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', size);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, max-age=300'); // Cache for 5 min

        stream.pipe(res);
    }

    @Get(':id/signed-download')
    @ApiOperation({ summary: 'Download a file using signed URL (no auth required)' })
    async signedDownloadFile(
        @Param('id') id: string,
        @Query('userId') userId: string,
        @Query('expires') expires: string,
        @Query('signature') signature: string,
        @Res() res: any,
    ) {
        // Validate signed params
        this.validateSignedParams(id, userId, expires, signature);

        // Get file for download
        const { stream, mimeType, fileName, size } = await this.filesService.downloadFile(
            id,
            userId,
        );

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Length', size);
        res.setHeader('Accept-Ranges', 'bytes');

        stream.pipe(res);
    }

    private validateSignedParams(
        fileId: string,
        userId: string,
        expires: string,
        signature: string,
    ): void {
        if (!userId || !expires || !signature) {
            throw new UnauthorizedException('Missing signed URL parameters');
        }

        const result = this.signedUrlService.verifySignedParams(
            fileId,
            userId,
            parseInt(expires, 10),
            signature,
        );

        if (!result.valid) {
            throw new UnauthorizedException(result.reason || 'Invalid signed URL');
        }
    }
}
