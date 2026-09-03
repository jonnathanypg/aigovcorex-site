import api from './api';
import type { LoginResponse, User } from '@/types';

export const authService = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const { data } = await api.post<LoginResponse>('/api/auth/login', { email, password });
        if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            // Notify RoleProvider to sync role immediately
            window.dispatchEvent(new Event('user-login'));
        }
        return data;
    },

    async getCurrentUser(): Promise<User> {
        const { data } = await api.get<{ user: User }>('/api/auth/me');
        return data.user;
    },

    getStoredUser(): User | null {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    },

    isAuthenticated(): boolean {
        if (typeof window === 'undefined') return false;
        return !!localStorage.getItem('access_token');
    },

    logout(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    },

    async updateProfile(data: Partial<User>): Promise<User> {
        const response = await api.put<{ user: User }>('/api/auth/update-profile', data);
        if (typeof window !== 'undefined') {
            // Update stored user
            const currentUser = this.getStoredUser();
            if (currentUser) {
                const updatedUser = { ...currentUser, ...response.data.user };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
        }
        return response.data.user;
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await api.post('/api/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
    }
};
