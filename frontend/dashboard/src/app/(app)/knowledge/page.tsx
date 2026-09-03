import { KnowledgeClient } from './knowledge-client';

export const metadata = {
    title: 'Base de Conocimiento | KindiCoreAI',
    description: 'Gestión de documentos para la base de conocimiento del asistente IA',
};

export default function KnowledgePage() {
    return <KnowledgeClient />;
}
