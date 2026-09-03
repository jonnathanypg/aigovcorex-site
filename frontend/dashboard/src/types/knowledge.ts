// Knowledge Base Types

export interface KnowledgeDocument {
    id: number;
    license_id: number;
    tenant_id: number | null;
    title: string;
    source_type: 'text' | 'pdf' | 'web' | 'docx';
    source_url: string | null;
    chunk_count: number;
    is_active: boolean;
    scope: 'global' | 'center';
    tenant_name: string | null;
    indexed_at: string | null;
    uploaded_by: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface KnowledgeListResponse {
    documents: KnowledgeDocument[];
    total: number;
    role: string;
}
