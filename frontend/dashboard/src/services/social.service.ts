import api from './api';

export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'currency' | 'select' | 'boolean' | 'date' | 'cedula' | 'file';
    required?: boolean;
    placeholder?: string;
    options?: string[];
    conversational_prompt?: string;
    scoring_weight?: number;
    section_id?: string;
    validation?: {
        min?: number;
        max?: number;
        min_length?: number;
        max_length?: number;
        regex?: string;
    };
}

export interface FormSection {
    id: string;
    title: string;
    description?: string;
    field_ids: string[];
}

export interface EligibilityRule {
    field: string;
    operator: '<=' | '>=' | '<' | '>' | '==' | 'in';
    value: any;
    points: number;
}

export interface ProgramFormDefinition {
    id?: number;
    program_id: number;
    form_title: string;
    form_description?: string;
    sections?: FormSection[];
    fields: FormField[];
    eligibility_rules?: EligibilityRule[];
    min_eligibility_score?: number;
    conversational_instructions?: string;
    success_message?: string;
    is_active?: boolean;
    version?: number;
}

export interface SocialProgram {
    id: number;
    name: string;
    short_code: string;
    category?: string;
    description?: string;
    objectives?: string;
    status: 'draft' | 'active' | 'paused' | 'closed';
    max_beneficiaries?: number;
    current_beneficiaries?: number;
    coverage_country?: string;
    coverage_regions?: string[];
    inherit_org_channels?: boolean;
    tags?: string[];
    form_definition?: ProgramFormDefinition;
    orgs_count?: number;
    beneficiaries_count?: number;
    created_at?: string;
}

export interface ProgramBeneficiary {
    id: number;
    program_id: number;
    full_name: string;
    cedula?: string;
    phone?: string;
    email?: string;
    address?: string;
    intake_channel: string;
    form_data: Record<string, any>;
    status: 'applicant' | 'approved' | 'rejected' | 'active';
    eligibility_score?: number;
    eligibility_notes?: string;
    created_at?: string;
}

export const socialService = {
    // Programs
    async getPrograms(): Promise<SocialProgram[]> {
        const res = await api.get('/api/social/programs');
        return res.data.data || [];
    },

    async getProgram(id: number): Promise<SocialProgram> {
        const res = await api.get(`/api/social/programs/${id}`);
        return res.data.data;
    },

    async createProgram(data: Partial<SocialProgram> & { form_fields?: FormField[] }): Promise<SocialProgram> {
        const res = await api.post('/api/social/programs', data);
        return res.data.data;
    },

    async updateProgram(id: number, data: Partial<SocialProgram>): Promise<SocialProgram> {
        const res = await api.put(`/api/social/programs/${id}`, data);
        return res.data.data;
    },

    // Dynamic Form Definition
    async getProgramForm(programId: number): Promise<ProgramFormDefinition> {
        const res = await api.get(`/api/social/programs/${programId}/form`);
        return res.data.data;
    },

    async updateProgramForm(programId: number, formData: Partial<ProgramFormDefinition>): Promise<ProgramFormDefinition> {
        const res = await api.put(`/api/social/programs/${programId}/form`, formData);
        return res.data.data;
    },

    // Copilot AI Generator
    async generateFormWithAI(programId: number, prompt: string): Promise<ProgramFormDefinition> {
        const res = await api.post(`/api/social/programs/${programId}/generate-form-ai`, { prompt });
        return res.data.data;
    },

    async aiCreateFullProgram(instruction: string, name?: string): Promise<SocialProgram> {
        const res = await api.post('/api/social/programs/ai-create-full', { instruction, name });
        return res.data.data;
    },

    // Submissions: Method A (Web Form Wizard)
    async submitForm(programId: number, data: {
        full_name?: string;
        cedula?: string;
        phone?: string;
        email?: string;
        address?: string;
        form_data: Record<string, any>;
        intake_channel?: string;
    }): Promise<{ success: boolean; message: string; beneficiary_id: number; eligibility_score: number }> {
        const res = await api.post(`/api/social/programs/${programId}/submit`, data);
        return res.data;
    },

    // Submissions: Method B (Conversational Engine Step)
    async conversationalStep(programId: number, payload: {
        message: string;
        session_id: string;
        collected_data?: Record<string, any>;
        history?: Array<{ role: 'assistant' | 'user'; content: string }>;
        user_name?: string;
        phone?: string;
        channel?: string;
    }): Promise<{
        success: boolean;
        completed: boolean;
        response: string;
        current_field?: string;
        progress_percent?: number;
        collected_data?: Record<string, any>;
        beneficiary_id?: number;
    }> {
        const res = await api.post(`/api/social/programs/${programId}/conversational-step`, payload);
        return res.data;
    },

    // Beneficiaries list
    async getBeneficiaries(programId: number, page = 1, status?: string): Promise<{
        data: ProgramBeneficiary[];
        pagination: { page: number; total: number; pages: number };
    }> {
        const params: Record<string, any> = { page };
        if (status) params.status = status;
        const res = await api.get(`/api/social/programs/${programId}/beneficiaries`, { params });
        return {
            data: res.data.data || [],
            pagination: res.data.pagination || { page: 1, total: 0, pages: 1 },
        };
    },

    async getAllBeneficiaries(params?: {
        program_id?: number;
        status?: string;
        channel?: string;
        search?: string;
        limit?: number;
    }): Promise<{
        data: ProgramBeneficiary[];
        total_active?: number;
        total_applicants?: number;
        total_approved?: number;
    }> {
        const res = await api.get('/api/social/beneficiaries', { params });
        return {
            data: res.data.data || [],
            total_active: res.data.total_active || 0,
            total_applicants: res.data.total_applicants || 0,
            total_approved: res.data.total_approved || 0,
        };
    },
};
