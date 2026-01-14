import api from './api';
import type { User } from './auth.service';

export interface PaginatedUsers {
    users: User[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface SystemStats {
    users: {
        total: number;
        active: number;
        inactive: number;
    };
    files: {
        total: number;
    };
    storage: {
        totalAllocated: number;
        totalUsed: number;
        totalAllocatedFormatted: string;
        totalUsedFormatted: string;
    };
}

export const adminService = {
    getUsers: async (page = 1, limit = 10, search?: string): Promise<PaginatedUsers> => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.append('search', search);
        const response = await api.get(`/admin/users?${params}`);
        return response.data;
    },

    getUserById: async (id: string): Promise<User & { filesCount: number }> => {
        const response = await api.get(`/admin/users/${id}`);
        return response.data;
    },

    updateUserStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<User> => {
        const response = await api.patch(`/admin/users/${id}/status`, { status });
        return response.data;
    },

    updateUserQuota: async (id: string, maxStorage: number): Promise<User> => {
        const response = await api.patch(`/admin/users/${id}/quota`, { maxStorage });
        return response.data;
    },

    getSystemStats: async (): Promise<SystemStats> => {
        const response = await api.get('/admin/stats');
        return response.data;
    },

    getAllSharedPermissions: async (page = 1, limit = 10): Promise<{ permissions: any[], total: number, totalPages: number }> => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        const response = await api.get(`/files/admin/permissions/all?${params}`);
        return response.data;
    },

    removeSharedPermission: async (ownerId: string, permissionId: string): Promise<void> => {
        await api.delete(`/files/admin/permissions/${ownerId}/${permissionId}`);
    },
};
