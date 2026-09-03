import api from './api';

export interface User {
    id: number;
    full_name: string;
    first_name: string;
    last_name: string;
    role: string;
    email: string;
    phone?: string;
    center?: string;
    is_active: boolean;
    last_login?: string;
    created_at?: string;
}

export const usersService = {
    async getAll(): Promise<User[]> {
        const { data } = await api.get<{ users: User[] }>('/api/users/');
        return data.users;
    },

    async getById(id: number): Promise<User> {
        const { data } = await api.get<{ user: User }>(`/api/users/${id}`);
        return data.user;
    },

    async create(userData: {
        email: string;
        password: string;
        first_name: string;
        last_name: string;
        role_id: number;
        phone?: string;
    }) {
        const { data } = await api.post('/api/users/', userData);
        return data;
    },

    async update(id: number, userData: Partial<User>) {
        const { data } = await api.put(`/api/users/${id}`, userData);
        return data;
    },

    async delete(id: number) {
        const { data } = await api.delete(`/api/users/${id}`);
        return data;
    }
};
