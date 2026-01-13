import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserRole } from '../users/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../users/schemas/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    try {
        const usersService = app.get(UsersService);
        const userModel = app.get<Model<User>>(getModelToken(User.name));

        // Create Admin
        const adminEmail = 'admin@example.com';
        const adminExists = await usersService.findByEmail(adminEmail);

        if (!adminExists) {
            console.log('Creating Admin user...');
            const adminDto: CreateUserDto = {
                email: adminEmail,
                password: 'admin123',
                name: 'Admin User',
            };

            // We create manually to set the role, as service.create doesn't support role
            const hashedPassword = await bcrypt.hash(adminDto.password, 10);
            const admin = new userModel({
                ...adminDto,
                password: hashedPassword,
                role: UserRole.ADMIN,
                maxStorage: 1073741824 * 10 // 10GB for admin
            });
            await admin.save();
            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user already exists.');
        }

        // Create User
        const userEmail = 'user@example.com';
        const userExists = await usersService.findByEmail(userEmail);

        if (!userExists) {
            console.log('Creating regular User...');
            const userDto: CreateUserDto = {
                email: userEmail,
                password: 'user123',
                name: 'Regular User',
            };
            await usersService.create(userDto);
            console.log('Regular user created successfully.');
        } else {
            console.log('Regular user already exists.');
        }

    } catch (error) {
        console.error('Error seeding users:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
