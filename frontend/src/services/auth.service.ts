import api from './api';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        maxStorage?: number;
        usedStorage?: number;
    };
    accessToken: string;
    refreshToken: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    maxStorage: number;
    usedStorage: number;
    createdAt: string;
}

export const authService = {
    login: async (data: LoginRequest): Promise<AuthResponse> => {
        const response = await api.post('/auth/login', data);
        return response.data;
    },

    register: async (data: RegisterRequest): Promise<AuthResponse> => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },

    logout: async (): Promise<void> => {
        await api.post('/auth/logout');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    },

    getProfile: async (): Promise<User> => {
        const response = await api.get('/users/me');
        return response.data;
    },

    getStorageInfo: async () => {
        const response = await api.get('/users/me/storage');
        return response.data;
    },
};
