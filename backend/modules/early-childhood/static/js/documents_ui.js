// Documents Management UI for Coordinator

class DocumentsManager {
    constructor() {
        this.currentChildId = null;
        this.currentApplicationId = null;
    }

    // Show documents modal for a child
    async showChildDocuments(childId, childName) {
        this.currentChildId = childId;
        this.currentApplicationId = null;

        const modal = this.createDocumentsModal(childName);
        document.body.appendChild(modal);
        modal.style.display = 'block';

        await this.loadDocuments();
    }

    // Show documents modal for an application
    async showApplicationDocuments(applicationId, childName) {
        this.currentApplicationId = applicationId;
        this.currentChildId = null;

        const modal = this.createDocumentsModal(childName);
        document.body.appendChild(modal);
        modal.style.display = 'block';

        await this.loadDocuments();
    }

    createDocumentsModal(childName) {
        let modal = document.getElementById('documents-modal');
        if (modal) {
            modal.remove();
        }

        modal = document.createElement('div');
        modal.id = 'documents-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <span class="close" onclick="documentsManager.closeModal()">&times;</span>
                <h2>📄 Documentos - ${childName}</h2>
                
                <!-- Upload Section -->
                <div class="glass-card mb-3">
                    <h3>Subir Nuevo Documento</h3>
                    <form id="upload-document-form" onsubmit="documentsManager.uploadDocument(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Tipo de Documento *</label>
                                <select id="doc-type" required>
                                    <option value="">Seleccione...</option>
                                    <option value="cedula_nino">Cédula del Niño</option>
                                    <option value="cedula_representante">Cédula del Representante</option>
                                    <option value="certificado_nacimiento">Certificado de Nacimiento</option>
                                    <option value="foto_nino">Foto del Niño</option>
                                    <option value="comprobante_domicilio">Comprobante de Domicilio</option>
                                    <option value="ficha_medica">Ficha Médica</option>
                                    <option value="carnet_vacunas">Carnet de Vacunas</option>
                                    <option value="informe_psicologico">Informe Psicológico</option>
                                    <option value="informe_social">Informe Social</option>
                                    <option value="acta_compromiso">Acta de Compromiso</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Archivo *</label>
                                <input type="file" id="doc-file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" required>
                                <small>Máximo 10MB. Formatos: PDF, JPG, PNG, DOC, DOCX</small>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Descripción</label>
                            <textarea id="doc-description" rows="2" placeholder="Descripción opcional del documento"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">📤 Subir Documento</button>
                    </form>
                </div>
                
                <!-- Documents List -->
                <div class="glass-card">
                    <h3>Documentos Registrados</h3>
                    <div id="documents-list">
                        <p class="text-center text-secondary">Cargando documentos...</p>
                    </div>
                </div>
            </div>
        `;

        return modal;
    }

    async uploadDocument(event) {
        event.preventDefault();

        const fileInput = document.getElementById('doc-file');
        const typeSelect = document.getElementById('doc-type');
        const descriptionInput = document.getElementById('doc-description');

        const file = fileInput.files[0];
        if (!file) {
            showNotification('Por favor seleccione un archivo', 'error');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            showNotification('El archivo excede el tamaño máximo de 10MB', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', typeSelect.value);
        formData.append('description', descriptionInput.value);

        if (this.currentChildId) {
            formData.append('child_id', this.currentChildId);
        } else if (this.currentApplicationId) {
            formData.append('application_id', this.currentApplicationId);
        }

        try {
            const response = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al subir documento');
            }

            const data = await response.json();
            showNotification('Documento subido exitosamente', 'success');

            // Reset form
            event.target.reset();

            // Reload documents list
            await this.loadDocuments();

        } catch (error) {
            console.error('Error uploading document:', error);
            showNotification(error.message || 'Error al subir documento', 'error');
        }
    }

    async loadDocuments() {
        const listDiv = document.getElementById('documents-list');
        if (!listDiv) return;

        listDiv.innerHTML = '<p class="text-center">Cargando...</p>';

        try {
            let endpoint;
            if (this.currentChildId) {
                endpoint = `/documents/child/${this.currentChildId}`;
            } else if (this.currentApplicationId) {
                endpoint = `/documents/application/${this.currentApplicationId}`;
            } else {
                return;
            }

            const response = await API.get(endpoint);
            const documents = response.documents;

            if (documents.length === 0) {
                listDiv.innerHTML = '<p class="text-center text-secondary">No hay documentos registrados</p>';
                return;
            }

            listDiv.innerHTML = '';
            documents.forEach(doc => {
                const card = this.createDocumentCard(doc);
                listDiv.appendChild(card);
            });

        } catch (error) {
            console.error('Error loading documents:', error);
            listDiv.innerHTML = '<p class="text-center text-danger">Error al cargar documentos</p>';
        }
    }

    createDocumentCard(doc) {
        const card = document.createElement('div');
        card.className = 'glass-card mb-2';

        const statusBadge = this.getStatusBadge(doc.status);
        const typeLabel = this.getTypeLabel(doc.document_type);

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                        <h4 style="margin: 0;">${this.getFileIcon(doc.file_name)} ${doc.file_name}</h4>
                        <span class="badge badge-${statusBadge.class}">${statusBadge.label}</span>
                    </div>
                    <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                        <strong>Tipo:</strong> ${typeLabel}<br>
                        <strong>Tamaño:</strong> ${this.formatFileSize(doc.file_size)}<br>
                        <strong>Subido:</strong> ${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A'} por ${doc.uploaded_by || 'N/A'}
                    </p>
                    ${doc.description ? `<p style="font-style: italic; color: var(--text-secondary);">${doc.description}</p>` : ''}
                    ${doc.rejection_reason ? `<p style="color: var(--danger);"><strong>Motivo de rechazo:</strong> ${doc.rejection_reason}</p>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm" onclick="documentsManager.downloadDocument(${doc.id})">
                        ⬇️ Descargar
                    </button>
                    ${doc.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="documentsManager.approveDocument(${doc.id})">
                            ✅ Aprobar
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="documentsManager.rejectDocument(${doc.id})">
                            ❌ Rechazar
                        </button>
                    ` : ''}
                    ${doc.version > 1 ? `
                        <button class="btn btn-secondary btn-sm" onclick="documentsManager.viewVersions(${doc.id})">
                            📋 Versiones (${doc.version})
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        return card;
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📄',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'doc': '📝',
            'docx': '📝'
        };
        return icons[ext] || '📎';
    }

    getStatusBadge(status) {
        const badges = {
            'pending': { class: 'warning', label: 'Pendiente' },
            'approved': { class: 'success', label: 'Aprobado' },
            'rejected': { class: 'danger', label: 'Rechazado' },
            'expired': { class: 'secondary', label: 'Expirado' }
        };
        return badges[status] || { class: 'secondary', label: status };
    }

    getTypeLabel(type) {
        const labels = {
            'cedula_nino': 'Cédula del Niño',
            'cedula_representante': 'Cédula del Representante',
            'certificado_nacimiento': 'Certificado de Nacimiento',
            'foto_nino': 'Foto del Niño',
            'comprobante_domicilio': 'Comprobante de Domicilio',
            'ficha_medica': 'Ficha Médica',
            'carnet_vacunas': 'Carnet de Vacunas',
            'informe_psicologico': 'Informe Psicológico',
            'informe_social': 'Informe Social',
            'acta_compromiso': 'Acta de Compromiso',
            'otro': 'Otro'
        };
        return labels[type] || type;
    }

    formatFileSize(bytes) {
        if (!bytes) return 'N/A';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async downloadDocument(docId) {
        try {
            const token = localStorage.getItem('access_token');
            window.open(`/api/documents/${docId}/download?token=${token}`, '_blank');
        } catch (error) {
            console.error('Error downloading document:', error);
            showNotification('Error al descargar documento', 'error');
        }
    }

    async approveDocument(docId) {
        if (!confirm('¿Aprobar este documento?')) return;

        try {
            await API.post(`/documents/${docId}/approve`, {});
            showNotification('Documento aprobado', 'success');
            await this.loadDocuments();
        } catch (error) {
            console.error('Error approving document:', error);
            showNotification(error.message || 'Error al aprobar documento', 'error');
        }
    }

    async rejectDocument(docId) {
        const reason = prompt('Motivo del rechazo:');
        if (!reason) return;

        try {
            await API.post(`/documents/${docId}/reject`, { reason });
            showNotification('Documento rechazado', 'success');
            await this.loadDocuments();
        } catch (error) {
            console.error('Error rejecting document:', error);
            showNotification(error.message || 'Error al rechazar documento', 'error');
        }
    }

    async viewVersions(docId) {
        try {
            const response = await API.get(`/documents/${docId}/versions`);
            alert(`Versiones del documento:\n\n${response.versions.map(v =>
                `v${v.version} - ${new Date(v.created_at).toLocaleDateString()} - ${v.status}`
            ).join('\n')}`);
        } catch (error) {
            console.error('Error loading versions:', error);
            showNotification('Error al cargar versiones', 'error');
        }
    }

    closeModal() {
        const modal = document.getElementById('documents-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
    }
}

// Global instance
const documentsManager = new DocumentsManager();
