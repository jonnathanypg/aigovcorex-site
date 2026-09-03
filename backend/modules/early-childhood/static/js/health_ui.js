// Health Management UI for Coordinator and Educator

class HealthManager {
    constructor() {
        this.currentChildId = null;
        this.currentChildName = '';
        this.vaccineSchedule = null;
    }

    async showHealthModal(childId, childName) {
        this.currentChildId = childId;
        this.currentChildName = childName;

        const modal = this.createHealthModal();
        document.body.appendChild(modal);
        modal.style.display = 'block';

        await this.loadHealthData();
    }

    createHealthModal() {
        let modal = document.getElementById('health-modal');
        if (modal) {
            modal.remove();
        }

        modal = document.createElement('div');
        modal.id = 'health-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px;">
                <span class="close" onclick="healthManager.closeModal()">&times;</span>
                <h2>🏥 Ficha de Salud - ${this.currentChildName}</h2>
                
                <!-- Tabs -->
                <div class="tabs-container" style="margin: 2rem 0;">
                    <button class="tab-btn active" onclick="healthManager.showTab('profile')">
                        📋 Perfil Médico
                    </button>
                    <button class="tab-btn" onclick="healthManager.showTab('growth')">
                        📈 Crecimiento
                    </button>
                    <button class="tab-btn" onclick="healthManager.showTab('vaccines')">
                        💉 Vacunas
                    </button>
                    <button class="tab-btn" onclick="healthManager.showTab('incidents')">
                        ⚠️ Incidentes
                    </button>
                </div>
                
                <!-- Tab: Profile -->
                <div id="health-tab-profile" class="tab-content active">
                    <div class="glass-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3>Información Médica</h3>
                            <button class="btn btn-primary" onclick="healthManager.editProfile()">✏️ Editar</button>
                        </div>
                        <div id="profile-content">
                            <p class="text-center">Cargando...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Tab: Growth -->
                <div id="health-tab-growth" class="tab-content" style="display: none;">
                    <div class="glass-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3>Registro de Crecimiento</h3>
                            <button class="btn btn-primary" onclick="healthManager.showGrowthForm()">➕ Nuevo Registro</button>
                        </div>
                        <div id="growth-content">
                            <p class="text-center">Cargando...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Tab: Vaccines -->
                <div id="health-tab-vaccines" class="tab-content" style="display: none;">
                    <div class="glass-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3>Registro de Vacunas</h3>
                            <button class="btn btn-primary" onclick="healthManager.showVaccineForm()">➕ Registrar Vacuna</button>
                        </div>
                        <div id="vaccines-content">
                            <p class="text-center">Cargando...</p>
                        </div>
                    </div>
                </div>
                
                <!-- Tab: Incidents -->
                <div id="health-tab-incidents" class="tab-content" style="display: none;">
                    <div class="glass-card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3>Incidentes de Salud</h3>
                            <button class="btn btn-primary" onclick="healthManager.showIncidentForm()">➕ Registrar Incidente</button>
                        </div>
                        <div id="incidents-content">
                            <p class="text-center">Cargando...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return modal;
    }

    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('#health-modal .tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        document.querySelectorAll('#health-modal .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        const tab = document.getElementById(`health-tab-${tabName}`);
        if (tab) {
            tab.style.display = 'block';
        }

        // Activate button
        event.target.classList.add('active');

        // Load content
        if (tabName === 'growth') {
            this.loadGrowthData();
        } else if (tabName === 'vaccines') {
            this.loadVaccinesData();
        } else if (tabName === 'incidents') {
            this.loadIncidents();
        }
    }

    async loadHealthData() {
        try {
            const response = await API.get(`/health/child/${this.currentChildId}`);
            this.vaccineSchedule = response.schedule;
            this.renderProfile(response.medical_profile, response.child);
            this.renderLatestGrowth(response.latest_growth);
        } catch (error) {
            console.error('Error loading health data:', error);
            showNotification('Error al cargar datos de salud', 'error');
        }
    }

    renderProfile(profile, child) {
        const container = document.getElementById('profile-content');
        if (!container) return;

        if (!profile) {
            container.innerHTML = `
                <p class="text-center text-secondary">No hay perfil médico registrado</p>
                <div class="text-center mt-2">
                    <button class="btn btn-primary" onclick="healthManager.editProfile()">Crear Perfil Médico</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="profile-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem;">
                <div>
                    <h4>Información Básica</h4>
                    <p><strong>Tipo de Sangre:</strong> ${profile.blood_type || 'No registrado'}</p>
                    <p><strong>Peso al Nacer:</strong> ${profile.birth_weight ? profile.birth_weight + ' kg' : 'No registrado'}</p>
                    <p><strong>Talla al Nacer:</strong> ${profile.birth_height ? profile.birth_height + ' cm' : 'No registrado'}</p>
                    <p><strong>Semanas de Gestación:</strong> ${profile.gestational_weeks || 'No registrado'}</p>
                </div>
                
                <div>
                    <h4>Pediatra</h4>
                    <p><strong>Nombre:</strong> ${profile.pediatrician_name || 'No registrado'}</p>
                    <p><strong>Teléfono:</strong> ${profile.pediatrician_phone || 'No registrado'}</p>
                    <p><strong>Hospital Preferido:</strong> ${profile.hospital_preference || 'No registrado'}</p>
                    <p><strong>Seguro:</strong> ${profile.insurance_info || 'No registrado'}</p>
                </div>
                
                <div>
                    <h4>Alergias</h4>
                    ${profile.allergies && profile.allergies.length > 0
                ? `<div class="tags">${profile.allergies.map(a => `<span class="badge badge-danger">${a}</span>`).join(' ')}</div>`
                : '<p class="text-secondary">Sin alergias registradas</p>'
            }
                </div>
                
                <div>
                    <h4>Condiciones Crónicas</h4>
                    ${profile.chronic_conditions && profile.chronic_conditions.length > 0
                ? `<div class="tags">${profile.chronic_conditions.map(c => `<span class="badge badge-warning">${c}</span>`).join(' ')}</div>`
                : '<p class="text-secondary">Sin condiciones registradas</p>'
            }
                </div>
                
                <div style="grid-column: span 2;">
                    <h4>Medicamentos de Emergencia</h4>
                    <p>${profile.emergency_medications || 'Sin instrucciones especiales'}</p>
                </div>
            </div>
        `;
    }

    renderLatestGrowth(growth) {
        if (!growth) return;

        // Show in profile as summary
        const profileContent = document.getElementById('profile-content');
        if (profileContent) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'glass-card mt-3';
            summaryDiv.innerHTML = `
                <h4>Último Control de Crecimiento (${new Date(growth.record_date).toLocaleDateString()})</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <h3>${growth.weight || '-'} kg</h3>
                        <p class="text-secondary">Peso</p>
                    </div>
                    <div>
                        <h3>${growth.height || '-'} cm</h3>
                        <p class="text-secondary">Talla</p>
                    </div>
                    <div>
                        <h3>${growth.head_circumference || '-'} cm</h3>
                        <p class="text-secondary">Perímetro Cefálico</p>
                    </div>
                </div>
            `;
            profileContent.appendChild(summaryDiv);
        }
    }

    async loadGrowthData() {
        const container = document.getElementById('growth-content');
        if (!container) return;

        container.innerHTML = '<p class="text-center">Cargando...</p>';

        try {
            const response = await API.get(`/health/child/${this.currentChildId}/growth`);
            const records = response.records;

            if (records.length === 0) {
                container.innerHTML = '<p class="text-center text-secondary">No hay registros de crecimiento</p>';
                return;
            }

            container.innerHTML = `
                <div class="growth-chart" style="margin-bottom: 2rem;">
                    <h4>Historial de Crecimiento</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
                        <div class="glass-card text-center">
                            <h3>${response.chart_data.weights[response.chart_data.weights.length - 1] || '-'} kg</h3>
                            <p class="text-secondary">Peso Actual</p>
                        </div>
                        <div class="glass-card text-center">
                            <h3>${response.chart_data.heights[response.chart_data.heights.length - 1] || '-'} cm</h3>
                            <p class="text-secondary">Talla Actual</p>
                        </div>
                        <div class="glass-card text-center">
                            <h3>${records.length}</h3>
                            <p class="text-secondary">Registros</p>
                        </div>
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="background: rgba(0,0,0,0.02); border-bottom: 2px solid var(--border-color);">
                        <tr>
                            <th style="padding: 1rem; text-align: left;">Fecha</th>
                            <th style="padding: 1rem; text-align: center;">Peso (kg)</th>
                            <th style="padding: 1rem; text-align: center;">Talla (cm)</th>
                            <th style="padding: 1rem; text-align: center;">P. Cefálico (cm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.reverse().map(r => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 1rem;">${new Date(r.record_date).toLocaleDateString()}</td>
                                <td style="padding: 1rem; text-align: center;">${r.weight || '-'}</td>
                                <td style="padding: 1rem; text-align: center;">${r.height || '-'}</td>
                                <td style="padding: 1rem; text-align: center;">${r.head_circumference || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        } catch (error) {
            console.error('Error loading growth data:', error);
            container.innerHTML = '<p class="text-center text-danger">Error al cargar datos</p>';
        }
    }

    async loadVaccinesData() {
        const container = document.getElementById('vaccines-content');
        if (!container) return;

        container.innerHTML = '<p class="text-center">Cargando...</p>';

        try {
            const response = await API.get(`/health/child/${this.currentChildId}/vaccines`);
            const vaccines = response.vaccines;
            this.vaccineSchedule = response.schedule;

            container.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card success">
                        <h3>${response.total_applied}</h3>
                        <p>Aplicadas</p>
                    </div>
                    <div class="stat-card warning">
                        <h3>${response.total_pending}</h3>
                        <p>Pendientes</p>
                    </div>
                    <div class="stat-card danger">
                        <h3>${vaccines.overdue.length}</h3>
                        <p>Atrasadas</p>
                    </div>
                    <div class="stat-card">
                        <h3>${vaccines.omitted.length}</h3>
                        <p>Omitidas</p>
                    </div>
                </div>
                
                ${vaccines.overdue.length > 0 ? `
                    <div class="glass-card mb-3" style="border-left: 4px solid var(--danger);">
                        <h4>⚠️ Vacunas Atrasadas</h4>
                        ${vaccines.overdue.map(v => `
                            <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                                <strong>${v.vaccine_name}</strong> (Dosis ${v.dose_number})
                                <span class="badge badge-danger">Vencida: ${new Date(v.next_dose_date).toLocaleDateString()}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <h4>✅ Vacunas Aplicadas</h4>
                ${vaccines.applied.length > 0 ? `
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
                        <thead style="background: rgba(0,0,0,0.02);">
                            <tr>
                                <th style="padding: 0.75rem; text-align: left;">Vacuna</th>
                                <th style="padding: 0.75rem; text-align: center;">Dosis</th>
                                <th style="padding: 0.75rem; text-align: center;">Fecha</th>
                                <th style="padding: 0.75rem; text-align: left;">Aplicado por</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${vaccines.applied.map(v => `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 0.75rem;">${v.vaccine_name}</td>
                                    <td style="padding: 0.75rem; text-align: center;">${v.dose_number}</td>
                                    <td style="padding: 0.75rem; text-align: center;">${new Date(v.date_applied).toLocaleDateString()}</td>
                                    <td style="padding: 0.75rem;">${v.applied_by || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="text-secondary">No hay vacunas aplicadas registradas</p>'}
            `;

        } catch (error) {
            console.error('Error loading vaccines:', error);
            container.innerHTML = '<p class="text-center text-danger">Error al cargar vacunas</p>';
        }
    }

    async loadIncidents() {
        const container = document.getElementById('incidents-content');
        if (!container) return;

        container.innerHTML = '<p class="text-center">Cargando...</p>';

        try {
            const response = await API.get(`/health/child/${this.currentChildId}`);
            const records = response.recent_records.filter(r =>
                ['incidente', 'enfermedad'].includes(r.record_type)
            );

            if (records.length === 0) {
                container.innerHTML = '<p class="text-center text-secondary">No hay incidentes registrados</p>';
                return;
            }

            container.innerHTML = records.map(r => `
                <div class="glass-card mb-2" style="border-left: 4px solid ${r.record_type === 'incidente' ? 'var(--warning)' : 'var(--danger)'};">
                    <div style="display: flex; justify-content: space-between;">
                        <h4>${r.record_type === 'incidente' ? '⚠️ Incidente' : '🤒 Enfermedad'}</h4>
                        <span class="text-secondary">${new Date(r.record_date).toLocaleDateString()}</span>
                    </div>
                    <p><strong>Descripción:</strong> ${r.incident_description || 'No especificado'}</p>
                    ${r.symptoms ? `<p><strong>Síntomas:</strong> ${r.symptoms}</p>` : ''}
                    ${r.treatment ? `<p><strong>Tratamiento:</strong> ${r.treatment}</p>` : ''}
                    ${r.medical_professional ? `<p><strong>Atendido por:</strong> ${r.medical_professional}</p>` : ''}
                    ${r.notes ? `<p><strong>Notas:</strong> ${r.notes}</p>` : ''}
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading incidents:', error);
            container.innerHTML = '<p class="text-center text-danger">Error al cargar incidentes</p>';
        }
    }

    editProfile() {
        showNotification('Formulario de edición de perfil médico en desarrollo', 'info');
        // TODO: Implement profile edit modal
    }

    showGrowthForm() {
        const form = prompt('Ingrese: peso,talla,perímetro (ej: 12.5,85,48)');
        if (!form) return;

        const [weight, height, head] = form.split(',').map(v => v.trim());

        API.post(`/health/child/${this.currentChildId}/growth`, {
            weight: parseFloat(weight) || null,
            height: parseFloat(height) || null,
            head_circumference: parseFloat(head) || null
        }).then(() => {
            showNotification('Registro de crecimiento guardado', 'success');
            this.loadGrowthData();
        }).catch(error => {
            showNotification('Error al guardar registro', 'error');
        });
    }

    showVaccineForm() {
        const name = prompt('Nombre de la vacuna (ej: Pentavalente):');
        if (!name) return;

        const dose = prompt('Número de dosis (1, 2, 3...):') || '1';
        const dateApplied = prompt('Fecha de aplicación (YYYY-MM-DD):') || new Date().toISOString().split('T')[0];
        const appliedBy = prompt('Aplicado por:') || '';

        API.post(`/health/child/${this.currentChildId}/vaccine`, {
            vaccine_name: name,
            dose_number: parseInt(dose),
            date_applied: dateApplied,
            applied_by: appliedBy,
            status: 'aplicada'
        }).then(() => {
            showNotification('Vacuna registrada', 'success');
            this.loadVaccinesData();
        }).catch(error => {
            showNotification('Error al registrar vacuna', 'error');
        });
    }

    showIncidentForm() {
        const type = confirm('¿Es un incidente? (OK = Incidente, Cancelar = Enfermedad)') ? 'incidente' : 'enfermedad';
        const description = prompt('Descripción del incidente/enfermedad:');
        if (!description) return;

        const symptoms = prompt('Síntomas (opcional):') || '';
        const treatment = prompt('Tratamiento aplicado (opcional):') || '';

        API.post(`/health/child/${this.currentChildId}/incident`, {
            record_type: type,
            description: description,
            symptoms: symptoms,
            treatment: treatment
        }).then(() => {
            showNotification('Incidente registrado', 'success');
            this.loadIncidents();
        }).catch(error => {
            showNotification('Error al registrar incidente', 'error');
        });
    }

    closeModal() {
        const modal = document.getElementById('health-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
    }
}

// Global instance
const healthManager = new HealthManager();
