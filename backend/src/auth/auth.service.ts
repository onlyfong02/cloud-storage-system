import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto';
import { UserStatus } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async register(registerDto: RegisterDto) {
        const user = await this.usersService.create(registerDto);
        const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);
        await this.usersService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

        return {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            ...tokens,
        };
    }

    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmailWithPassword(loginDto.email);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await this.usersService.validatePassword(user, loginDto.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw new ForbiddenException('Account is inactive. Please contact administrator.');
        }

        const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);
        await this.usersService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

        return {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                maxStorage: user.maxStorage,
                usedStorage: user.usedStorage,
            },
            ...tokens,
        };
    }

    async refreshTokens(refreshTokenDto: RefreshTokenDto) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshTokenDto.refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET') || '',
            });

            const user = await this.usersService.findById(payload.sub);

            if (!user || user.refreshToken !== refreshTokenDto.refreshToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            if (user.status !== UserStatus.ACTIVE) {
                throw new ForbiddenException('Account is inactive');
            }

            const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);
            await this.usersService.updateRefreshToken(user._id.toString(), tokens.refreshToken);

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(userId: string) {
        await this.usersService.updateRefreshToken(userId, null);
        return { message: 'Logged out successfully' };
    }

    private async generateTokens(userId: string, email: string, role: string) {
        const payload = { sub: userId, email, role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_SECRET') || '',
                expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '1h') as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET') || '',
                expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any,
            }),
        ]);

        return { accessToken, refreshToken };
    }
}
