import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SignedUrlService {
    private readonly secret: string;

    constructor(private configService: ConfigService) {
        this.secret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
    }

    /**
     * Generate a signed URL for file access
     * @param fileId - The file ID to access
     * @param userId - The user ID requesting access
     * @param expiresInMinutes - How long the URL should be valid (default: 5 minutes)
     * @returns Object with signature, expires timestamp, and the full signed params string
     */
    generateSignedParams(
        fileId: string,
        userId: string,
        expiresInMinutes: number = 5,
    ): { signature: string; expires: number; userId: string } {
        const expires = Date.now() + expiresInMinutes * 60 * 1000;
        const dataToSign = `${fileId}:${userId}:${expires}`;
        const signature = this.createSignature(dataToSign);

        return {
            signature,
            expires,
            userId,
        };
    }

    /**
     * Verify a signed URL
     * @param fileId - The file ID being accessed
     * @param userId - The user ID from the signed params
     * @param expires - The expiration timestamp from the signed params
     * @param signature - The signature from the signed params
     * @returns true if valid, false otherwise
     */
    verifySignedParams(
        fileId: string,
        userId: string,
        expires: number,
        signature: string,
    ): { valid: boolean; reason?: string } {
        // Check if expired
        if (Date.now() > expires) {
            return { valid: false, reason: 'URL has expired' };
        }

        // Verify signature
        const dataToSign = `${fileId}:${userId}:${expires}`;
        const expectedSignature = this.createSignature(dataToSign);

        if (signature !== expectedSignature) {
            return { valid: false, reason: 'Invalid signature' };
        }

        return { valid: true };
    }

    private createSignature(data: string): string {
        return crypto
            .createHmac('sha256', this.secret)
            .update(data)
            .digest('hex');
    }
}
