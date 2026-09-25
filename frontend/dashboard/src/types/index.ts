// Auth Types
export interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    role: string;
    tenant_id: number | null;
    is_active: boolean;
    phone?: string;
    avatar_url?: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    user: User;
}

// Dashboard Types
export interface DashboardStats {
    total_children: number;
    attendance_rate: number;
    present_today: number;
    expected_today: number;
    critical_alerts: number;
    pending_applications: number;
    is_global: boolean;
    tenant_name: string;
    tenants_summary?: TenantSummary[];
}

export interface TenantSummary {
    id: number;
    name: string;
    children_count: number;
    capacity: number;
}

export interface RecentApplication {
    id: number;
    child_name: string;
    status: 'pending' | 'approved' | 'rejected' | 'waitlist';
    submission_date: string;
    center: string;
}

// Child Types
export interface Child {
    id: number;
    tenant_id: number;
    tenant_name?: string;
    family_id: number;
    full_name: string;
    first_name: string;
    last_name: string;
    cedula?: string;
    birth_date: string;
    age_months: number;
    age_display: string;
    gender: 'M' | 'F';
    status: 'activo' | 'inactivo' | 'egresado' | 'lista_espera';
    enrollment_date: string;
    assigned_group?: string;
    photo_url?: string;
    allergies?: string;
    medical_conditions?: string;
    special_needs?: string;
}

export interface Representative {
    id: number;
    full_name: string;
    first_name: string;
    last_name: string;
    cedula?: string;
    relationship: string;
    phone?: string;
    email?: string;
    occupation?: string;
    workplace?: string;
    is_primary: boolean;
}

// Attendance Types
export interface AttendanceRecord {
    id: number;
    child_id: number;
    child_name: string;
    date: string;
    status: 'presente' | 'ausente' | 'justificado';
    arrival_time?: string;
    departure_time?: string;
    notes?: string;
    registered_by?: string;
}

// Application Types
export interface Application {
    id: number;
    child_first_name: string;
    child_last_name: string;
    child_name: string;
    child_age_months: number;
    submission_date: string;
    status: 'pending' | 'approved' | 'rejected' | 'waitlist';
    priority_score?: number;
    family_phone?: string;
}

// Health Types
export interface HealthRecord {
    id: number;
    child_id: number;
    child_name: string;
    record_date: string;
    record_type: 'crecimiento' | 'vacunacion' | 'incidente';
    weight?: number;
    height?: number;
    notes?: string;
}

// Milestone Types
export interface Milestone {
    id: number;
    child_id: number;
    record_date: string;
    domain: string;
    domain_name: string;
    milestone_description: string;
    achievement_level: string;
    achievement_percentage: number;
}

// Nutrition Types
export interface NutritionRecord {
    id: number;
    child_id: number;
    child_name: string;
    date: string;
    meal_type: 'desayuno' | 'almuerzo' | 'refrigerio_am' | 'refrigerio_pm';
    consumption_level: 'todo' | 'la_mayoria' | 'la_mitad' | 'poco' | 'nada';
}

// API Response Types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}
