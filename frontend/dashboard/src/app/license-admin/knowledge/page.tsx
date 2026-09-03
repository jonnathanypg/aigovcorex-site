import { KnowledgeClient } from '../../(app)/knowledge/knowledge-client';

export const metadata = {
    title: 'Base de Conocimiento (Admin) | KindiCoreAI',
    description: 'Gestión global de la base de conocimiento',
};

export default function LicenseAdminKnowledgePage() {
    return <KnowledgeClient />;
}
