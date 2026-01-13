import {
    Controller,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { UpdateUserStatusDto, UpdateUserQuotaDto } from '../users/dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('users')
    @ApiOperation({ summary: 'Get all users (Admin only)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    async getAllUsers(
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('search') search?: string,
    ) {
        return this.adminService.getAllUsers(Number(page), Number(limit), search);
    }

    @Get('users/:id')
    @ApiOperation({ summary: 'Get user details (Admin only)' })
    async getUserById(@Param('id') id: string) {
        return this.adminService.getUserById(id);
    }

    @Patch('users/:id/status')
    @ApiOperation({ summary: 'Update user status (Admin only)' })
    async updateUserStatus(
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateUserStatusDto,
    ) {
        return this.adminService.updateUserStatus(id, updateStatusDto);
    }

    @Patch('users/:id/quota')
    @ApiOperation({ summary: 'Update user storage quota (Admin only)' })
    async updateUserQuota(
        @Param('id') id: string,
        @Body() updateQuotaDto: UpdateUserQuotaDto,
    ) {
        return this.adminService.updateUserQuota(id, updateQuotaDto);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get system statistics (Admin only)' })
    async getSystemStats() {
        return this.adminService.getSystemStats();
    }
}
