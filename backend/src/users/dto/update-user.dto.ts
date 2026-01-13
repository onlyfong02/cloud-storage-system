import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../schemas/user.schema';

export class UpdateUserDto {
    @ApiProperty({ required: false, example: 'John Doe' })
    @IsOptional()
    @IsString()
    name?: string;
}

export class UpdateUserStatusDto {
    @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
    @IsEnum(UserStatus)
    status: UserStatus;
}

export class UpdateUserQuotaDto {
    @ApiProperty({ example: 5368709120, description: 'Max storage in bytes' })
    @IsNumber()
    @Min(0)
    maxStorage: number;
}

export class UpdateUserRoleDto {
    @ApiProperty({ enum: UserRole, example: UserRole.USER })
    @IsEnum(UserRole)
    role: UserRole;
}
