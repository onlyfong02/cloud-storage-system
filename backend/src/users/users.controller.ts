import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    async getProfile(@Request() req) {
        return this.usersService.findById(req.user.userId);
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update current user profile' })
    async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(req.user.userId, updateUserDto);
    }

    @Get('me/storage')
    @ApiOperation({ summary: 'Get current user storage info' })
    async getStorageInfo(@Request() req) {
        const user = await this.usersService.findById(req.user.userId);
        return {
            maxStorage: user.maxStorage,
            usedStorage: user.usedStorage,
            availableStorage: user.maxStorage - user.usedStorage,
            usagePercentage: Math.round((user.usedStorage / user.maxStorage) * 100),
        };
    }
}
