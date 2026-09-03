// Milestones Management UI for Coordinator

class MilestonesManager {
    constructor() {
        this.currentChildId = null;
        this.currentChildName = '';
        this.currentChildAge = 0;
        this.catalog = null;
    }

    async showMilestonesModal(childId, childName, ageMonths) {
        this.currentChildId = childId;
        this.currentChildName = childName;
        this.currentChildAge = ageMonths || 0;

        const modal = this.createMilestonesModal();
        document.body.appendChild(modal);
        modal.style.display = 'block';

        await this.loadCatalog();
        await this.loadChildProgress();
    }

    createMilestonesModal() {
        let modal = document.getElementById('milestones-modal');
        if (modal) {
            modal.remove();
        }

        modal = document.createElement('div');
        modal.id = 'milestones-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px;">
                <span class="close" onclick="milestonesManager.closeModal()">&times;</span>
                <h2>📈 Hitos de Desarrollo - ${this.currentChildName}</h2>
                <p style="color: var(--text-secondary);">Edad: ${Math.floor(this.currentChildAge / 12)} años, ${this.currentChildAge % 12} meses</p>
                
                <!-- Tabs -->
                <div class="tabs-container" style="margin: 2rem 0;">
                    <button class="tab-btn active" onclick="milestonesManager.showTab('register')">
                        ✏️ Registrar Hitos
                    </button>
                    <button class="tab-btn" onclick="milestonesManager.showTab('progress')">
                        📊 Ver Progreso
                    </button>
                    <button class="tab-btn" onclick="milestonesManager.showTab('history')">
                        📋 Historial
                    </button>
                </div>
                
                <!-- Tab: Register -->
                <div id="tab-register" class="tab-content active">
                    <div class="glass-card">
                        <h3>Registrar Nuevos Hitos</h3>
                        
                        <!-- Domain Selector -->
                        <div class="form-group">
                            <label>Dominio del Desarrollo</label>
                            <select id="milestone-domain" onchange="milestonesManager.loadDomainCatalog()">
                                <option value="">Seleccione un dominio...</option>
                                <option value="vinculacion_emocional">🤗 Vinculación Emocional y Social</option>
                                <option value="descubrimiento_natural_cultural">🌍 Descubrimiento Natural y Cultural</option>
                                <option value="expresion_corporal">🏃 Expresión Corporal y Motricidad</option>
                                <option value="lenguaje">💬 Comprensión y Expresión del Lenguaje</option>
                            </select>
                        </div>
                        
                        <!-- Catalog Items -->
                        <div id="catalog-items" style="margin-top: 2rem;">
                            <p class="text-secondary text-center">Seleccione un dominio para ver los hitos</p>
                        </div>
                        
                        <!-- Notes -->
                        <div class="form-group" style="margin-top: 2rem;">
                            <label>Observaciones Generales</label>
                            <textarea id="milestone-notes" rows="3" placeholder="Notas adicionales sobre el desarrollo del niño..."></textarea>
                        </div>
                        
                        <button class="btn btn-primary" onclick="milestonesManager.saveMilestones()">
                            💾 Guardar Hitos Registrados
                        </button>
                    </div>
                </div>
                
                <!-- Tab: Progress -->
                <div id="tab-progress" class="tab-content" style="display: none;">
                    <div class="glass-card">
                        <h3>Progreso por Dominio</h3>
                        <div id="progress-content">
                            <p class="text-center">Cargando progreso...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Tab: History -->
                <div id="tab-history" class="tab-content" style="display: none;">
                    <div class="glass-card">
                        <h3>Historial de Hitos Registrados</h3>
                        <div id="history-content">
                            <p class="text-center">Cargando historial...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return modal;
    }

    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        const tab = document.getElementById(`tab-${tabName}`);
        if (tab) {
            tab.style.display = 'block';
        }

        // Activate button
        event.target.classList.add('active');

        // Load content if needed
        if (tabName === 'progress') {
            this.loadChildProgress();
        } else if (tabName === 'history') {
            this.loadMilestonesHistory();
        }
    }

    async loadCatalog() {
        try {
            const response = await API.get(`/milestones/catalog/child/${this.currentChildId}`);
            this.catalog = response.catalog;
        } catch (error) {
            console.error('Error loading catalog:', error);
            showNotification('Error al cargar catálogo de hitos', 'error');
        }
    }

    loadDomainCatalog() {
        const domain = document.getElementById('milestone-domain').value;
        const container = document.getElementById('catalog-items');

        if (!domain || !this.catalog) {
            container.innerHTML = '<p class="text-secondary text-center">Seleccione un dominio</p>';
            return;
        }

        const milestones = this.catalog.milestones[domain] || [];

        if (milestones.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center">No hay hitos para este dominio</p>';
            return;
        }

        container.innerHTML = `
            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                Marque los hitos alcanzados y su nivel de logro:
            </p>
        `;

        milestones.forEach((milestone, index) => {
            const item = document.createElement('div');
            item.className = 'milestone-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(0,0,0,0.02); border-radius: 8px; margin-bottom: 0.5rem;';

            item.innerHTML = `
                <input type="checkbox" id="milestone-${index}" value="${milestone}" 
                    style="width: 20px; height: 20px;">
                <label for="milestone-${index}" style="flex: 1; cursor: pointer;">
                    ${milestone}
                </label>
                <select id="level-${index}" class="milestone-level" style="padding: 0.5rem; border-radius: 5px; border: 1px solid var(--border-color);">
                    <option value="no_iniciado">No iniciado</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="adquirido" selected>Adquirido</option>
                    <option value="consolidado">Consolidado</option>
                </select>
            `;

            container.appendChild(item);
        });
    }

    async saveMilestones() {
        const domain = document.getElementById('milestone-domain').value;
        if (!domain) {
            showNotification('Seleccione un dominio', 'error');
            return;
        }

        const notes = document.getElementById('milestone-notes').value;
        const checkboxes = document.querySelectorAll('#catalog-items input[type="checkbox"]:checked');

        if (checkboxes.length === 0) {
            showNotification('Seleccione al menos un hito', 'error');
            return;
        }

        try {
            for (const checkbox of checkboxes) {
                const index = checkbox.id.split('-')[1];
                const level = document.getElementById(`level-${index}`).value;

                await API.post('/milestones/record', {
                    child_id: this.currentChildId,
                    domain: domain,
                    milestone_description: checkbox.value,
                    achievement_level: level,
                    notes: notes
                });
            }

            showNotification(`${checkboxes.length} hito(s) registrado(s) exitosamente`, 'success');

            // Reset form
            document.getElementById('milestone-domain').value = '';
            document.getElementById('milestone-notes').value = '';
            document.getElementById('catalog-items').innerHTML = '<p class="text-secondary text-center">Seleccione un dominio</p>';

            // Reload progress
            await this.loadChildProgress();

        } catch (error) {
            console.error('Error saving milestones:', error);
            showNotification(error.message || 'Error al guardar hitos', 'error');
        }
    }

    async loadChildProgress() {
        const container = document.getElementById('progress-content');
        if (!container) return;

        container.innerHTML = '<p class="text-center">Cargando...</p>';

        try {
            const response = await API.get(`/milestones/child/${this.currentChildId}/progress`);
            const progress = response.progress_by_domain;
            const average = response.average_progress;

            container.innerHTML = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h2 style="font-size: 3rem; margin: 0;">${average}%</h2>
                    <p style="color: var(--text-secondary);">Progreso Promedio General</p>
                </div>
                
                <div class="progress-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                    ${Object.entries(progress).map(([domain, data]) => `
                        <div class="domain-progress glass-card">
                            <h4>${this.getDomainIcon(domain)} ${this.getDomainName(domain)}</h4>
                            <div class="progress-bar" style="height: 20px; background: rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; margin: 1rem 0;">
                                <div class="progress-fill" style="height: 100%; width: ${data.achievement_percentage}%; background: ${this.getProgressColor(data.achievement_percentage)}; transition: width 0.3s;"></div>
                            </div>
                            <p style="font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0;">${data.achievement_percentage}%</p>
                            <p style="color: var(--text-secondary); font-size: 0.9rem;">
                                ${data.latest_milestone || 'Sin hitos registrados'}
                            </p>
                            <p style="color: var(--text-secondary); font-size: 0.85rem;">
                                Nivel: ${this.getLevelLabel(data.achievement_level)}
                            </p>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Error loading progress:', error);
            container.innerHTML = '<p class="text-center text-danger">Error al cargar progreso</p>';
        }
    }

    async loadMilestonesHistory() {
        const container = document.getElementById('history-content');
        if (!container) return;

        container.innerHTML = '<p class="text-center">Cargando...</p>';

        try {
            const response = await API.get(`/milestones/child/${this.currentChildId}`);
            const milestones = response.milestones;

            if (milestones.length === 0) {
                container.innerHTML = '<p class="text-center text-secondary">No hay hitos registrados</p>';
                return;
            }

            container.innerHTML = `
                <div class="milestones-timeline">
                    ${milestones.map(m => `
                        <div class="timeline-item glass-card mb-2">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <h4>${this.getDomainIcon(m.domain)} ${m.domain_display}</h4>
                                    <p style="margin: 0.5rem 0;">${m.milestone_description}</p>
                                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                                        <strong>Nivel:</strong> ${this.getLevelLabel(m.achievement_level)} (${m.achievement_percentage}%)<br>
                                        <strong>Fecha:</strong> ${new Date(m.record_date).toLocaleDateString()}<br>
                                        <strong>Registrado por:</strong> ${m.registered_by || 'N/A'}
                                    </p>
                                    ${m.notes ? `<p style="font-style: italic; color: var(--text-secondary);">${m.notes}</p>` : ''}
                                </div>
                                <span class="badge badge-${this.getLevelBadge(m.achievement_level)}">
                                    ${m.achievement_percentage}%
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Error loading history:', error);
            container.innerHTML = '<p class="text-center text-danger">Error al cargar historial</p>';
        }
    }

    getDomainIcon(domain) {
        const icons = {
            'vinculacion_emocional': '🤗',
            'descubrimiento_natural_cultural': '🌍',
            'expresion_corporal': '🏃',
            'lenguaje': '💬'
        };
        return icons[domain] || '📌';
    }

    getDomainName(domain) {
        const names = {
            'vinculacion_emocional': 'Vinculación Emocional',
            'descubrimiento_natural_cultural': 'Descubrimiento Natural',
            'expresion_corporal': 'Expresión Corporal',
            'lenguaje': 'Lenguaje'
        };
        return names[domain] || domain;
    }

    getLevelLabel(level) {
        const labels = {
            'no_iniciado': 'No Iniciado',
            'en_proceso': 'En Proceso',
            'adquirido': 'Adquirido',
            'consolidado': 'Consolidado'
        };
        return labels[level] || level;
    }

    getLevelBadge(level) {
        const badges = {
            'no_iniciado': 'secondary',
            'en_proceso': 'warning',
            'adquirido': 'info',
            'consolidado': 'success'
        };
        return badges[level] || 'secondary';
    }

    getProgressColor(percentage) {
        if (percentage >= 75) return 'var(--success)';
        if (percentage >= 50) return 'var(--info)';
        if (percentage >= 25) return 'var(--warning)';
        return 'var(--danger)';
    }

    closeModal() {
        const modal = document.getElementById('milestones-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
    }
}

// Global instance
const milestonesManager = new MilestonesManager();
