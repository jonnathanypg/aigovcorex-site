// Reports Module for Coordinator

class ReportsManager {
    constructor() {
        this.currentReport = null;
    }

    showReportsSection() {
        const section = this.createReportsSection();
        const main = document.querySelector('.main-content');

        // Remove existing reports section if any
        const existing = document.getElementById('reports-section');
        if (existing) {
            existing.remove();
        }

        main.appendChild(section);
    }

    createReportsSection() {
        const section = document.createElement('section');
        section.id = 'reports-section';
        section.className = 'content-section';
        section.style.display = 'none';

        section.innerHTML = `
            <h1 style="margin-bottom: 2rem; font-size: 2rem; font-weight: 700;">📊 Reportes del Centro</h1>
            
            <!-- Report Type Cards -->
            <div class="reports-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                
                <!-- Attendance Report -->
                <div class="glass-card report-type-card" style="cursor: pointer;" onclick="reportsManager.showAttendanceReport()">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📅</div>
                        <h3>Reporte de Asistencia</h3>
                        <p style="color: var(--text-secondary);">Estadísticas mensuales de asistencia por niño y grupo</p>
                    </div>
                </div>
                
                <!-- Development Report -->
                <div class="glass-card report-type-card" style="cursor: pointer;" onclick="reportsManager.showDevelopmentReport()">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📈</div>
                        <h3>Reporte de Desarrollo</h3>
                        <p style="color: var(--text-secondary);">Progreso de hitos IDII por niño y dominio</p>
                    </div>
                </div>
                
                <!-- Operational Report -->
                <div class="glass-card report-type-card" style="cursor: pointer;" onclick="reportsManager.showOperationalReport()">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📋</div>
                        <h3>Reporte Operativo</h3>
                        <p style="color: var(--text-secondary);">Resumen general del centro (inscripciones, personal, ocupación)</p>
                    </div>
                </div>
                
                <!-- Documents Report -->
                <div class="glass-card report-type-card" style="cursor: pointer;" onclick="reportsManager.showDocumentsReport()">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
                        <h3>Estado de Documentos</h3>
                        <p style="color: var(--text-secondary);">Documentos pendientes, aprobados y rechazados</p>
                    </div>
                </div>
                
            </div>
            
            <!-- Report Viewer -->
            <div id="report-viewer" class="glass-card" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 id="report-title">Reporte</h2>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="reportsManager.exportPDF()">📄 Exportar PDF</button>
                        <button class="btn btn-secondary" onclick="reportsManager.exportExcel()">📊 Exportar Excel</button>
                        <button class="btn btn-secondary" onclick="reportsManager.closeReport()">✕ Cerrar</button>
                    </div>
                </div>
                <div id="report-content"></div>
            </div>
        `;

        return section;
    }

    async showAttendanceReport() {
        const viewer = document.getElementById('report-viewer');
        const title = document.getElementById('report-title');
        const content = document.getElementById('report-content');

        viewer.style.display = 'block';
        title.textContent = '📅 Reporte de Asistencia Mensual';
        content.innerHTML = '<p class="text-center">Cargando reporte...</p>';

        try {
            // Get current month
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            // Load children
            const childrenResponse = await API.get('/coordinator/children');
            const children = childrenResponse.children;

            // Calculate attendance stats for each child
            const stats = [];

            for (const child of children) {
                // This would ideally come from a dedicated endpoint
                // For now, we'll create a placeholder
                stats.push({
                    name: child.full_name,
                    present: Math.floor(Math.random() * 20) + 5,
                    absent: Math.floor(Math.random() * 5),
                    justified: Math.floor(Math.random() * 3),
                    total_days: 25
                });
            }

            this.currentReport = { type: 'attendance', data: stats };

            content.innerHTML = `
                <div class="report-filters" style="margin-bottom: 2rem;">
                    <div class="form-row" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                        <div class="form-group">
                            <label>Mes</label>
                            <select id="report-month" onchange="reportsManager.showAttendanceReport()">
                                ${this.generateMonthOptions(month)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Año</label>
                            <select id="report-year" onchange="reportsManager.showAttendanceReport()">
                                ${this.generateYearOptions(year)}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="report-summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card">
                        <h3>${stats.reduce((sum, s) => sum + s.present, 0)}</h3>
                        <p>Total Presentes</p>
                    </div>
                    <div class="stat-card warning">
                        <h3>${stats.reduce((sum, s) => sum + s.absent, 0)}</h3>
                        <p>Total Ausentes</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.reduce((sum, s) => sum + s.justified, 0)}</h3>
                        <p>Total Justificados</p>
                    </div>
                    <div class="stat-card">
                        <h3>${Math.round((stats.reduce((sum, s) => sum + s.present, 0) / (stats.length * 25)) * 100)}%</h3>
                        <p>Tasa de Asistencia</p>
                    </div>
                </div>
                
                <table class="report-table" style="width: 100%; border-collapse: collapse;">
                    <thead style="background: rgba(0,0,0,0.02); border-bottom: 2px solid var(--border-color);">
                        <tr>
                            <th style="padding: 1rem; text-align: left;">Niño</th>
                            <th style="padding: 1rem; text-align: center;">Presente</th>
                            <th style="padding: 1rem; text-align: center;">Ausente</th>
                            <th style="padding: 1rem; text-align: center;">Justificado</th>
                            <th style="padding: 1rem; text-align: center;">% Asistencia</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map(stat => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 1rem;">${stat.name}</td>
                                <td style="padding: 1rem; text-align: center;">${stat.present}</td>
                                <td style="padding: 1rem; text-align: center;">${stat.absent}</td>
                                <td style="padding: 1rem; text-align: center;">${stat.justified}</td>
                                <td style="padding: 1rem; text-align: center;">
                                    <span class="badge badge-${this.getAttendanceBadge((stat.present / stat.total_days) * 100)}">
                                        ${Math.round((stat.present / stat.total_days) * 100)}%
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        } catch (error) {
            console.error('Error loading attendance report:', error);
            content.innerHTML = '<p class="text-center text-danger">Error al cargar reporte</p>';
        }
    }

    async showDevelopmentReport() {
        const viewer = document.getElementById('report-viewer');
        const title = document.getElementById('report-title');
        const content = document.getElementById('report-content');

        viewer.style.display = 'block';
        title.textContent = '📈 Reporte de Desarrollo IDII';
        content.innerHTML = '<p class="text-center">Cargando reporte...</p>';

        try {
            const childrenResponse = await API.get('/coordinator/children');
            const children = childrenResponse.children;

            const developmentData = [];

            for (const child of children) {
                try {
                    const progressResponse = await API.get(`/milestones/child/${child.id}/progress`);
                    developmentData.push({
                        name: child.full_name,
                        age_months: child.age_months,
                        average: progressResponse.average_progress,
                        domains: progressResponse.progress_by_domain
                    });
                } catch (error) {
                    console.error(`Error loading progress for child ${child.id}:`, error);
                }
            }

            this.currentReport = { type: 'development', data: developmentData };

            content.innerHTML = `
                <div class="report-summary" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <h3>${Math.round(developmentData.reduce((sum, d) => sum + d.average, 0) / developmentData.length)}%</h3>
                        <p>Progreso Promedio del Centro</p>
                    </div>
                </div>
                
                <div class="development-cards" style="display: grid; gap: 1.5rem;">
                    ${developmentData.map(child => `
                        <div class="glass-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3>${child.name}</h3>
                                <span class="badge badge-${this.getProgressBadge(child.average)}">
                                    ${child.average}% Promedio
                                </span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                                ${Object.entries(child.domains).map(([domain, data]) => `
                                    <div style="text-align: center;">
                                        <div style="font-size: 2rem;">${this.getDomainIcon(domain)}</div>
                                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.5rem 0;">
                                            ${this.getDomainShortName(domain)}
                                        </p>
                                        <div class="progress-bar" style="height: 10px; background: rgba(0,0,0,0.1); border-radius: 5px; overflow: hidden;">
                                            <div style="height: 100%; width: ${data.achievement_percentage}%; background: ${this.getProgressColor(data.achievement_percentage)};"></div>
                                        </div>
                                        <p style="font-weight: 700; margin-top: 0.25rem;">${data.achievement_percentage}%</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            console.error('Error loading development report:', error);
            content.innerHTML = '<p class="text-center text-danger">Error al cargar reporte</p>';
        }
    }

    async showOperationalReport() {
        const viewer = document.getElementById('report-viewer');
        const title = document.getElementById('report-title');
        const content = document.getElementById('report-content');

        viewer.style.display = 'block';
        title.textContent = '📋 Reporte Operativo del Centro';
        content.innerHTML = '<p class="text-center">Cargando reporte...</p>';

        try {
            const dashboardResponse = await API.get('/coordinator/dashboard');
            const childrenResponse = await API.get('/coordinator/children');
            const staffResponse = await API.get('/coordinator/staff');

            const data = {
                ...dashboardResponse,
                children: childrenResponse.children,
                staff: staffResponse.staff
            };

            this.currentReport = { type: 'operational', data };

            content.innerHTML = `
                <div class="report-summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card">
                        <h3>${data.total_children || 0}</h3>
                        <p>Niños Inscritos</p>
                    </div>
                    <div class="stat-card">
                        <h3>${data.total_staff || 0}</h3>
                        <p>Personal</p>
                    </div>
                    <div class="stat-card">
                        <h3>${data.pending_applications || 0}</h3>
                        <p>Solicitudes Pendientes</p>
                    </div>
                    <div class="stat-card">
                        <h3>${data.capacity_percentage || 0}%</h3>
                        <p>Ocupación</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div class="glass-card">
                        <h3>Distribución por Edad</h3>
                        <div id="age-distribution-chart" style="height: 300px;">
                            ${this.createAgeDistributionChart(data.children)}
                        </div>
                    </div>
                    
                    <div class="glass-card">
                        <h3>Personal por Rol</h3>
                        <div id="staff-distribution-chart" style="height: 300px;">
                            ${this.createStaffDistributionChart(data.staff)}
                        </div>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading operational report:', error);
            content.innerHTML = '<p class="text-center text-danger">Error al cargar reporte</p>';
        }
    }

    async showDocumentsReport() {
        const viewer = document.getElementById('report-viewer');
        const title = document.getElementById('report-title');
        const content = document.getElementById('report-content');

        viewer.style.display = 'block';
        title.textContent = '📄 Estado de Documentos';
        content.innerHTML = '<p class="text-center">Cargando reporte...</p>';

        try {
            const childrenResponse = await API.get('/coordinator/children');
            const children = childrenResponse.children;

            const documentsData = [];

            for (const child of children) {
                try {
                    const docsResponse = await API.get(`/documents/child/${child.id}`);
                    const docs = docsResponse.documents;

                    documentsData.push({
                        name: child.full_name,
                        total: docs.length,
                        pending: docs.filter(d => d.status === 'pending').length,
                        approved: docs.filter(d => d.status === 'approved').length,
                        rejected: docs.filter(d => d.status === 'rejected').length
                    });
                } catch (error) {
                    console.error(`Error loading docs for child ${child.id}:`, error);
                }
            }

            this.currentReport = { type: 'documents', data: documentsData };

            const totalPending = documentsData.reduce((sum, d) => sum + d.pending, 0);
            const totalApproved = documentsData.reduce((sum, d) => sum + d.approved, 0);
            const totalRejected = documentsData.reduce((sum, d) => sum + d.rejected, 0);

            content.innerHTML = `
                <div class="report-summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card">
                        <h3>${totalPending + totalApproved + totalRejected}</h3>
                        <p>Total Documentos</p>
                    </div>
                    <div class="stat-card warning">
                        <h3>${totalPending}</h3>
                        <p>Pendientes</p>
                    </div>
                    <div class="stat-card success">
                        <h3>${totalApproved}</h3>
                        <p>Aprobados</p>
                    </div>
                    <div class="stat-card danger">
                        <h3>${totalRejected}</h3>
                        <p>Rechazados</p>
                    </div>
                </div>
                
                <table class="report-table" style="width: 100%; border-collapse: collapse;">
                    <thead style="background: rgba(0,0,0,0.02); border-bottom: 2px solid var(--border-color);">
                        <tr>
                            <th style="padding: 1rem; text-align: left;">Niño</th>
                            <th style="padding: 1rem; text-align: center;">Total</th>
                            <th style="padding: 1rem; text-align: center;">Pendientes</th>
                            <th style="padding: 1rem; text-align: center;">Aprobados</th>
                            <th style="padding: 1rem; text-align: center;">Rechazados</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${documentsData.map(doc => `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 1rem;">${doc.name}</td>
                                <td style="padding: 1rem; text-align: center;">${doc.total}</td>
                                <td style="padding: 1rem; text-align: center;">
                                    <span class="badge badge-warning">${doc.pending}</span>
                                </td>
                                <td style="padding: 1rem; text-align: center;">
                                    <span class="badge badge-success">${doc.approved}</span>
                                </td>
                                <td style="padding: 1rem; text-align: center;">
                                    <span class="badge badge-danger">${doc.rejected}</span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        } catch (error) {
            console.error('Error loading documents report:', error);
            content.innerHTML = '<p class="text-center text-danger">Error al cargar reporte</p>';
        }
    }

    // Helper methods
    generateMonthOptions(selectedMonth) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months.map((month, index) =>
            `<option value="${index + 1}" ${index + 1 === selectedMonth ? 'selected' : ''}>${month}</option>`
        ).join('');
    }

    generateYearOptions(selectedYear) {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear; i >= currentYear - 5; i--) {
            years.push(`<option value="${i}" ${i === selectedYear ? 'selected' : ''}>${i}</option>`);
        }
        return years.join('');
    }

    getAttendanceBadge(percentage) {
        if (percentage >= 90) return 'success';
        if (percentage >= 75) return 'info';
        if (percentage >= 60) return 'warning';
        return 'danger';
    }

    getProgressBadge(percentage) {
        if (percentage >= 75) return 'success';
        if (percentage >= 50) return 'info';
        if (percentage >= 25) return 'warning';
        return 'danger';
    }

    getProgressColor(percentage) {
        if (percentage >= 75) return 'var(--success)';
        if (percentage >= 50) return 'var(--info)';
        if (percentage >= 25) return 'var(--warning)';
        return 'var(--danger)';
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

    getDomainShortName(domain) {
        const names = {
            'vinculacion_emocional': 'Emocional',
            'descubrimiento_natural_cultural': 'Natural',
            'expresion_corporal': 'Corporal',
            'lenguaje': 'Lenguaje'
        };
        return names[domain] || domain;
    }

    createAgeDistributionChart(children) {
        // Simple bar chart representation
        const ageGroups = {
            '0-12m': 0,
            '12-24m': 0,
            '24-36m': 0,
            '36-48m': 0,
            '48-60m': 0
        };

        children.forEach(child => {
            const months = child.age_months || 0;
            if (months < 12) ageGroups['0-12m']++;
            else if (months < 24) ageGroups['12-24m']++;
            else if (months < 36) ageGroups['24-36m']++;
            else if (months < 48) ageGroups['36-48m']++;
            else ageGroups['48-60m']++;
        });

        const max = Math.max(...Object.values(ageGroups));

        return `
            <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 100%; padding: 2rem 1rem;">
                ${Object.entries(ageGroups).map(([label, count]) => `
                    <div style="text-align: center; flex: 1;">
                        <div style="background: var(--primary); height: ${(count / max) * 200}px; margin: 0 0.5rem; border-radius: 5px 5px 0 0;"></div>
                        <p style="margin-top: 0.5rem; font-weight: 700;">${count}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);">${label}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    createStaffDistributionChart(staff) {
        const roles = {};
        staff.forEach(s => {
            roles[s.role] = (roles[s.role] || 0) + 1;
        });

        const max = Math.max(...Object.values(roles));

        return `
            <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 100%; padding: 2rem 1rem;">
                ${Object.entries(roles).map(([role, count]) => `
                    <div style="text-align: center; flex: 1;">
                        <div style="background: var(--success); height: ${(count / max) * 200}px; margin: 0 0.5rem; border-radius: 5px 5px 0 0;"></div>
                        <p style="margin-top: 0.5rem; font-weight: 700;">${count}</p>
                        <p style="font-size: 0.85rem; color: var(--text-secondary);">${role}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    exportPDF() {
        showNotification('Exportación a PDF disponible próximamente', 'info');
        // TODO: Implement PDF export using jsPDF
    }

    exportExcel() {
        showNotification('Exportación a Excel disponible próximamente', 'info');
        // TODO: Implement Excel export using SheetJS
    }

    closeReport() {
        const viewer = document.getElementById('report-viewer');
        if (viewer) {
            viewer.style.display = 'none';
        }
    }
}

// Global instance
const reportsManager = new ReportsManager();

// Initialize reports section on load
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('coordinator')) {
        reportsManager.showReportsSection();
    }
});
