// Coordinator Dashboard JavaScript

// Navigation
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
        if (link.getAttribute('href').startsWith('#')) {
            e.preventDefault();
            const target = link.getAttribute('href').replace('#', '');
            showSection(target);

            document.querySelectorAll('.nav-menu a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
});

function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    switch (sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'staff':
            loadStaff();
            break;
        case 'children':
            loadChildren();
            break;
    }
}

// Load Dashboard
async function loadDashboard() {
    try {
        const response = await API.get('/coordinator/dashboard');

        // Update center name
        document.getElementById('center-name').textContent = response.center.name;

        // Update stats
        document.getElementById('current-enrollment').textContent = response.stats.current_enrollment;
        document.getElementById('today-attendance').textContent = response.stats.today_attendance + '%';
        document.getElementById('total-staff').textContent = response.stats.total_staff;
        document.getElementById('pending-alerts').textContent = response.stats.pending_alerts;

        // Load recent activity
        loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error al cargar el dashboard', 'error');
    }
}

async function loadRecentActivity() {
    try {
        const response = await API.get('/coordinator/activity');
        const activityDiv = document.getElementById('recent-activity');

        if (response.activities.length === 0) {
            activityDiv.innerHTML = '<p class="text-secondary text-center py-3">No hay actividad reciente</p>';
            return;
        }

        let html = '<div style="display: grid; gap: 1rem;">';
        response.activities.forEach(act => {
            html += `
                <div style="padding: 1rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem;">
                    <span class="badge badge-success">${act.time}</span>
                    <div>
                        <strong style="display: block; color: var(--text-primary);">${act.user}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.9em;">${act.action}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        activityDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// Load Staff
async function loadStaff() {
    try {
        const response = await API.get('/coordinator/staff');
        const tbody = document.getElementById('staff-tbody');
        tbody.innerHTML = '';

        if (response.staff.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">No hay personal registrado</td></tr>';
            return;
        }

        response.staff.forEach(member => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 1rem;">${member.first_name} ${member.last_name}</td>
                <td style="padding: 1rem;"><span class="badge badge-info">${formatRole(member.role)}</span></td>
                <td style="padding: 1rem;">${member.email}</td>
                <td style="padding: 1rem;">${member.phone || '-'}</td>
                <td style="padding: 1rem;">
                    <span class="badge badge-${member.is_active ? 'success' : 'danger'}">
                        ${member.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading staff:', error);
        showNotification('Error al cargar personal', 'error');
    }
}

function formatRole(role) {
    const roles = {
        'center_coordinator': 'Coordinador',
        'educadora': 'Educadora',
        'psicologo': 'Psicólogo',
        'nutricionista': 'Nutricionista',
        'trabajador_social': 'Trabajador Social',
        'medico': 'Médico',
        'administrativo': 'Administrativo'
    };
    return roles[role] || role;
}

// Load Children
async function loadChildren() {
    try {
        const search = document.getElementById('search-child').value;
        const response = await API.get(`/coordinator/children?search=${search}`);
        const grid = document.getElementById('children-grid');
        grid.innerHTML = '';

        if (response.children.length === 0) {
            grid.innerHTML = '<div class="glass-card empty-state" style="grid-column: 1/-1;"><p>No hay niños inscritos</p></div>';
            return;
        }

        response.children.forEach(child => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">
                    ${child.first_name} ${child.last_name}
                </h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">
                    ${child.age_months ? Math.floor(child.age_months / 12) + ' años' : 'Edad no registrada'}
                </p>
                <span class="badge badge-${child.is_active ? 'success' : 'warning'}">
                    ${child.is_active ? 'Activo' : 'Inactivo'}
                </span>
            `;
            card.onclick = () => viewChildProfile(child.id);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading children:', error);
        showNotification('Error al cargar niños', 'error');
    }
}

// Search children
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-child');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            loadChildren();
        }, 300));
    }
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Register Child
function showRegisterChildModal() {
    document.getElementById('register-child-modal').style.display = 'block';
}

async function registerChild(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        await API.post('/coordinator/children', data);
        showNotification('Niño inscrito exitosamente', 'success');
        closeModal('register-child-modal');
        event.target.reset();
        loadChildren();
        loadDashboard(); // Refresh stats

    } catch (error) {
        console.error('Error registering child:', error);
        showNotification(error.message || 'Error al inscribir niño', 'error');
    }
}

function viewChildProfile(childId) {
    // Redirect to child profile page
    window.location.href = `/children/${childId}`;
}

// Modal Functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Notification Function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Logout
function logout() {
    Auth.logout();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // Verify user has coordinator role
    const userData = Auth.getUserData();
    if (!userData || userData.role !== 'center_coordinator') {
        alert('Acceso denegado. Se requiere rol de Coordinador.');
        Auth.logout();
        return;
    }

    loadDashboard();
});

// ==================== APPLICATIONS MANAGEMENT ====================

// Load Applications
async function loadApplications() {
    try {
        const status = document.getElementById('filter-application-status').value;
        const response = await API.get(`/applications/list?status=${status}`);
        const listDiv = document.getElementById('applications-list');
        listDiv.innerHTML = '';

        if (response.applications.length === 0) {
            listDiv.innerHTML = '<div class="glass-card empty-state"><p>No hay solicitudes</p></div>';
            return;
        }

        response.applications.forEach(app => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">${app.child_name}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">
                            ${app.child_age_months ? Math.floor(app.child_age_months / 12) + ' años' : 'Edad no registrada'}
                        </p>
                    </div>
                    <span class="badge badge-${getStatusBadge(app.status)}">${getStatusLabel(app.status)}</span>
                </div>
                <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
                    <span>📅 ${app.submission_date || 'N/A'}</span>
                    <span>📊 Score: ${app.priority_score || 'N/A'}</span>
                    <span>📞 ${app.family_phone || 'N/A'}</span>
                </div>
                <div class="form-actions" style="margin-top: 0;">
                    <button class="btn btn-secondary btn-sm" onclick="viewApplicationDetails(${app.id})">👁️ Ver Detalles</button>
                    ${app.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="approveApplication(${app.id})">✅ Aprobar</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectApplication(${app.id})">❌ Rechazar</button>
                        <button class="btn btn-secondary btn-sm" onclick="moveToWaitlist(${app.id})">⏳ Lista de Espera</button>
                    ` : ''}
                </div>
            `;
            listDiv.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading applications:', error);
        showNotification('Error al cargar solicitudes', 'error');
    }
}

function getStatusBadge(status) {
    const badges = {
        'pending': 'warning',
        'approved': 'success',
        'rejected': 'danger',
        'waitlist': 'info'
    };
    return badges[status] || 'secondary';
}

function getStatusLabel(status) {
    const labels = {
        'pending': 'Pendiente',
        'approved': 'Aprobada',
        'rejected': 'Rechazada',
        'waitlist': 'Lista de Espera'
    };
    return labels[status] || status;
}

async function viewApplicationDetails(applicationId) {
    try {
        const response = await API.get(`/applications/${applicationId}`);

        // Create a detailed view modal (simplified for now)
        alert(`Detalles de Solicitud:\n\nNiño: ${response.application.child_first_name} ${response.application.child_last_name}\nFamilia: ${response.family.city}, ${response.family.province}\nScore: ${response.application.priority_score || 'N/A'}\n\nEsta funcionalidad se expandirá con un modal completo.`);

    } catch (error) {
        console.error('Error viewing application:', error);
        showNotification('Error al cargar detalles', 'error');
    }
}

async function approveApplication(applicationId) {
    if (!confirm('¿Está seguro de aprobar esta solicitud? Se creará el registro del niño.')) {
        return;
    }

    const notes = prompt('Notas de aprobación (opcional):');

    try {
        await API.post(`/applications/${applicationId}/approve`, { notes });
        showNotification('Solicitud aprobada y niño inscrito exitosamente', 'success');
        loadApplications();
        loadDashboard(); // Refresh stats

    } catch (error) {
        console.error('Error approving application:', error);
        showNotification(error.message || 'Error al aprobar solicitud', 'error');
    }
}

async function rejectApplication(applicationId) {
    const notes = prompt('Motivo del rechazo:');
    if (!notes) return;

    try {
        await API.post(`/applications/${applicationId}/reject`, { notes });
        showNotification('Solicitud rechazada', 'success');
        loadApplications();

    } catch (error) {
        console.error('Error rejecting application:', error);
        showNotification(error.message || 'Error al rechazar solicitud', 'error');
    }
}

async function moveToWaitlist(applicationId) {
    if (!confirm('¿Mover esta solicitud a la lista de espera?')) {
        return;
    }

    try {
        const response = await API.post(`/applications/${applicationId}/waitlist`, {});
        showNotification(`Movido a lista de espera. Posición: ${response.position}`, 'success');
        loadApplications();

    } catch (error) {
        console.error('Error moving to waitlist:', error);
        showNotification(error.message || 'Error al mover a lista de espera', 'error');
    }
}

function showNewApplicationModal() {
    document.getElementById('new-application-modal').style.display = 'block';
    applicationWizard.init();
    // Add at least one representative by default
    applicationWizard.addRepresentative();
}

// Enhanced view application details (replaces the simple version)
async function viewApplicationDetailsEnhanced(applicationId) {
    try {
        const response = await API.get(`/applications/${applicationId}`);
        const app = response.application;
        const family = response.family;
        const reps = response.representatives;
        const vuln = response.vulnerability;

        let modal = document.getElementById('view-application-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'view-application-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        let content = `
            <div class="modal-content" style="max-width: 900px;">
                <span class="close" onclick="closeModal('view-application-modal')">&times;</span>
                <h2>Detalles de Solicitud</h2>
                
                <div class="detail-section">
                    <h3>👶 Información del Niño/a</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Nombre Completo</label>
                            <div class="value">${app.child_first_name} ${app.child_last_name}</div>
                        </div>
                        <div class="detail-item">
                            <label>Edad</label>
                            <div class="value">${app.child_age_months ? Math.floor(app.child_age_months / 12) + ' años' : 'N/A'}</div>
                        </div>
                        <div class="detail-item">
                            <label>Estado</label>
                            <div class="value"><span class="badge badge-${getStatusBadge(app.status)}">${getStatusLabel(app.status)}</span></div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>🏠 Información Familiar</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Ciudad</label>
                            <div class="value">${family.city || 'N/A'}</div>
                        </div>
                        <div class="detail-item">
                            <label>Teléfono</label>
                            <div class="value">${family.phone_primary || 'N/A'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>👥 Representantes (${reps.length})</h3>
                    ${reps.map(rep => `
                        <div class="glass-card mb-2">
                            <h4>${rep.full_name} ${rep.is_primary ? '<span class="badge badge-primary">Principal</span>' : ''}</h4>
                            <p>${rep.relationship} - ${rep.phone || 'Sin teléfono'}</p>
                        </div>
                    `).join('')}
                </div>
                
                ${vuln ? `
                <div class="detail-section">
                    <h3>📊 Score de Vulnerabilidad</h3>
                    <div style="text-align: center; margin: 2rem 0;">
                        <div class="score-badge score-${vuln.vulnerability_score >= 70 ? 'high' : vuln.vulnerability_score >= 40 ? 'medium' : 'low'}">
                            ${vuln.vulnerability_score || 0}/100
                        </div>
                    </div>
                </div>
                ` : ''}
                
                ${app.status === 'pending' ? `
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="approveApplication(${app.id}); closeModal('view-application-modal');">✅ Aprobar</button>
                    <button class="btn btn-danger" onclick="rejectApplication(${app.id}); closeModal('view-application-modal');">❌ Rechazar</button>
                    <button class="btn btn-secondary" onclick="moveToWaitlist(${app.id}); closeModal('view-application-modal');">⏳ Lista de Espera</button>
                </div>
                ` : ''}
            </div>
        `;

        modal.innerHTML = content;
        modal.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al cargar detalles', 'error');
    }
}

// Override the original function
viewApplicationDetails = viewApplicationDetailsEnhanced;

// Add documents button to child actions
function showChildDocuments(childId, childName) {
    documentsManager.showChildDocuments(childId, childName);
}

// Add documents button to application details
function showApplicationDocuments(applicationId, childName) {
    documentsManager.showApplicationDocuments(applicationId, childName);
}

// Milestones integration
function showChildMilestones(childId, childName, ageMonths) {
    milestonesManager.showMilestonesModal(childId, childName, ageMonths);
}

// Update showSection to include reports
// Update showSection to include reports
const originalCoordinatorShowSection = showSection;
showSection = function (sectionName) {
    // Hide all sections first
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }

    // Handle specific loads
    switch (sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'staff':
            loadStaff();
            break;
        case 'children':
            loadChildren();
            break;
        case 'reports':
            // Reports logic is handled in reports.js but we ensure container is visible
            if (typeof loadReports === 'function') loadReports();
            break;
    }

    // Update navigation
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionName}`) {
            link.classList.add('active');
        }
    });

    // Close mobile menu if open
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('active');
    }
};
