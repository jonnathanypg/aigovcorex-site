// Main JavaScript - KindiCore AI CDI Management System

// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// Theme Manager
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.createToggleButton();
    }

    toggle() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateToggleIcon();
    }

    createToggleButton() {
        // Check if button already exists
        if (document.querySelector('.theme-toggle')) return;

        const button = document.createElement('button');
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Toggle theme');
        button.innerHTML = this.getIcon();
        button.addEventListener('click', () => this.toggle());
        document.body.appendChild(button);
    }

    updateToggleIcon() {
        const button = document.querySelector('.theme-toggle');
        if (button) {
            button.innerHTML = this.getIcon();
        }
    }

    getIcon() {
        if (this.theme === 'light') {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/>
            </svg>`;
        } else {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
            </svg>`;
        }
    }
}

// Authentication
class Auth {
    static getToken() {
        return localStorage.getItem('access_token');
    }

    static setToken(token) {
        localStorage.setItem('access_token', token);
    }

    static removeToken() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
    }

    static getUserData() {
        const data = localStorage.getItem('user_data');
        return data ? JSON.parse(data) : null;
    }

    static setUserData(userData) {
        localStorage.setItem('user_data', JSON.stringify(userData));
    }

    static getUserRole() {
        const userData = this.getUserData();
        return userData ? userData.role : null;
    }

    static isAuthenticated() {
        return !!this.getToken();
    }

    static async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error de autenticación');
        }

        const data = await response.json();
        this.setToken(data.access_token);
        this.setUserData(data.user);
        return data;
    }

    static async logout() {
        try {
            await API.post('/auth/logout', {});
        } catch (error) {
            console.error('Error during logout:', error);
        }
        this.removeToken();
        window.location.href = '/';
    }

    static redirectToDashboard() {
        const role = this.getUserRole();

        switch (role) {
            case 'super_admin':
                window.location.href = '/super-admin';
                break;
            case 'license_admin':
                window.location.href = '/license-admin';
                break;
            case 'center_coordinator':
                window.location.href = '/coordinator';
                break;
            case 'educadora':
                window.location.href = '/educator';
                break;
            case 'psicologo':
            case 'nutricionista':
            case 'trabajador_social':
            case 'medico':
            case 'administrativo':
                window.location.href = '/dashboard';
                break;
            default:
                window.location.href = '/dashboard';
        }
    }
}

// API Client
class API {
    static async request(endpoint, options = {}) {
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            Auth.logout();
            throw new Error('Sesión expirada');
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en la solicitud');
        }

        return await response.json();
    }

    static async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Initialize Theme on page load
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Export for global use
window.KindiCore = {
    Auth,
    API,
    ThemeManager
};
