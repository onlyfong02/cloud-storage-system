import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({ example: 'oldPassword123', description: 'Current password' })
    @IsString()
    oldPassword: string;

    @ApiProperty({ example: 'newPassword123', description: 'New password (min 6 characters)' })
    @IsString()
    @MinLength(6, { message: 'New password must be at least 6 characters long' })
    newPassword: string;
}
