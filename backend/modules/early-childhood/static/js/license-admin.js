// License Admin Dashboard JavaScript

let centersCache = {};
let usersCache = {};

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
    
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'centers':
            loadCenters();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Load Dashboard
async function loadDashboard() {
    try {
        const response = await API.get('/license-admin/dashboard');
        
        // Update license info
        document.getElementById('license-name').textContent = response.license.name;
        document.getElementById('lic-name').textContent = response.license.name;
        document.getElementById('lic-centers').textContent = `${response.license.active_centers} / ${response.license.max_centers}`;
        document.getElementById('lic-validity').textContent = `${response.license.start_date} - ${response.license.end_date}`;
        
        // Update stats
        document.getElementById('centers-count').textContent = response.centers_count;
        document.getElementById('total-capacity').textContent = response.total_capacity;
        document.getElementById('total-enrollment').textContent = response.total_enrollment;
        document.getElementById('total-staff').textContent = response.total_staff || 0;
        document.getElementById('occupancy-rate').textContent = response.occupancy_rate + '%';
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error al cargar el dashboard', 'error');
    }
}

// Load Centers
async function loadCenters() {
    try {
        const response = await API.get('/license-admin/centers');
        const gridDiv = document.getElementById('centers-grid');
        gridDiv.innerHTML = '';
        
        centersCache = {};
        
        // Update filter options for users page
        updateCenterFilter(response.centers);
        updateUserFormCenterOptions(response.centers);
        
        if (response.centers.length === 0) {
            gridDiv.innerHTML = '<div class="glass-card empty-state" style="grid-column: 1/-1;"><p>No hay centros creados. Crea tu primer centro.</p></div>';
            return;
        }
        
        response.centers.forEach(center => {
            centersCache[center.id] = center;
            
            const card = document.createElement('div');
            // Using glass-card with flex column layout
            card.className = 'glass-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.innerHTML = `
                <div style="flex: 1;">
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--primary);">
                        ${center.name}
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
                        📍 ${center.city}, ${center.province}
                    </p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; font-size: 0.9rem;">
                        <div style="background: rgba(0,0,0,0.03); padding: 0.75rem; border-radius: 8px;">
                            <span style="display: block; font-size: 0.75rem; color: var(--text-secondary);">Capacidad</span>
                            <span style="font-weight: 600;">${center.current_enrollment} / ${center.max_capacity}</span>
                        </div>
                        <div style="background: rgba(0,0,0,0.03); padding: 0.75rem; border-radius: 8px;">
                            <span style="display: block; font-size: 0.75rem; color: var(--text-secondary);">Ocupación</span>
                            <span style="font-weight: 600;">${Math.round((center.current_enrollment / center.max_capacity) * 100)}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: auto; padding-top: 1rem; justify-content: space-between;">
                    <button class="btn btn-secondary btn-sm" onclick="viewCenterStats(${center.id})">
                        📊 Estadísticas
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="editCenter(${center.id})">
                        ✏️ Editar
                    </button>
                </div>
            `;
            gridDiv.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading centers:', error);
        showNotification('Error al cargar centros', 'error');
    }
}

function updateCenterFilter(centers) {
    const select = document.getElementById('filter-center');
    // Save current selection
    const currentVal = select.value;
    
    // Clear options except first
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    centers.forEach(center => {
        const option = document.createElement('option');
        option.value = center.id;
        option.textContent = center.name;
        select.appendChild(option);
    });
    
    // Restore selection if possible
    if (currentVal) select.value = currentVal;
}

function updateUserFormCenterOptions(centers) {
    const select = document.getElementById('user-center-select');
    // Keep first placeholder option
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    centers.forEach(center => {
        const option = document.createElement('option');
        option.value = center.id;
        option.textContent = center.name;
        select.appendChild(option);
    });
}

// Create Center
function showCreateCenterModal() {
    document.getElementById('create-center-modal').style.display = 'block';
}

async function createCenter(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    data.max_capacity = parseInt(data.max_capacity);
    
    try {
        await API.post('/license-admin/centers', data);
        showNotification('Centro creado exitosamente', 'success');
        closeModal('create-center-modal');
        event.target.reset();
        loadCenters();
        loadDashboard();
        
    } catch (error) {
        console.error('Error creating center:', error);
        showNotification(error.message || 'Error al crear centro', 'error');
    }
}

// Load Users
async function loadUsers() {
    try {
        // Build query params
        const centerId = document.getElementById('filter-center').value;
        const role = document.getElementById('filter-role').value;
        let query = '';
        if (centerId) query += `center_id=${centerId}&`;
        if (role) query += `role=${role}`;
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        usersCache = {}; // Reset cache
        
        try {
            const response = await API.get(`/license-admin/users?${query}`);
            if (response.users && response.users.length > 0) {
                
                // Sort users by name
                response.users.sort((a, b) => a.first_name.localeCompare(b.first_name));

                response.users.forEach(user => {
                    usersCache[user.id] = user;
                    
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid var(--border-color)';
                    tr.innerHTML = `
                        <td style="padding: 1rem;">${user.first_name} ${user.last_name}</td>
                        <td style="padding: 1rem;">${user.email}</td>
                        <td style="padding: 1rem;">${user.center_name || '-'}</td>
                        <td style="padding: 1rem;">
                            <span class="badge badge-info">${formatRole(user.role)}</span>
                        </td>
                        <td style="padding: 1rem;">
                            <span class="badge badge-${user.is_active ? 'success' : 'danger'}">
                                ${user.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td style="padding: 1rem;">
                            <button class="btn btn-secondary btn-sm" onclick="editUser(${user.id})">✏️</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">No hay usuarios encontrados</td></tr>';
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Error al cargar usuarios</td></tr>';
        }
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function formatRole(role) {
    const roles = {
        'center_coordinator': 'Coordinador',
        'educadora': 'Educadora',
        'psicologo': 'Psicólogo',
        'nutricionista': 'Nutricionista',
        'trabajador_social': 'Trabajador S.',
        'medico': 'Médico',
        'administrativo': 'Admin.',
        'license_admin': 'Admin Licencia'
    };
    return roles[role] || role;
}

// Create User
function showCreateUserModal() {
    document.getElementById('create-user-modal').style.display = 'block';
}

async function createUser(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        await API.post('/license-admin/users', data);
        showNotification('Usuario creado exitosamente', 'success');
        closeModal('create-user-modal');
        event.target.reset();
        loadUsers();
        
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification(error.message || 'Error al crear usuario', 'error');
    }
}

// Edit Center (Optimized)
function editCenter(centerId) {
    const center = centersCache[centerId];
    
    if (!center) {
        showNotification('Error: Centro no encontrado en caché', 'error');
        return;
    }
    
    const form = document.getElementById('edit-center-form');
    form.querySelector('[name="center_id"]').value = center.id;
    form.querySelector('[name="name"]').value = center.name;
    form.querySelector('[name="legal_name"]').value = center.legal_name;
    form.querySelector('[name="ruc"]').value = center.ruc || '';
    form.querySelector('[name="max_capacity"]').value = center.max_capacity;
    form.querySelector('[name="city"]').value = center.city;
    form.querySelector('[name="province"]').value = center.province;
    form.querySelector('[name="address"]').value = center.address || '';
    form.querySelector('[name="phone"]').value = center.phone || '';
    form.querySelector('[name="email"]').value = center.email || '';
    
    document.getElementById('edit-center-modal').style.display = 'block';
}

async function updateCenter(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const centerId = data.center_id;
    
    // Convert numbers
    data.max_capacity = parseInt(data.max_capacity);
    
    try {
        await API.put(`/license-admin/centers/${centerId}`, data);
        showNotification('Centro actualizado exitosamente', 'success');
        closeModal('edit-center-modal');
        loadCenters();
        loadDashboard();
        
    } catch (error) {
        console.error('Error updating center:', error);
        showNotification(error.message || 'Error al actualizar centro', 'error');
    }
}

// Edit User (Optimized)
function editUser(userId) {
    const user = usersCache[userId];
    
    if (!user) {
        showNotification('Error: Usuario no encontrado en caché', 'error');
        return;
    }
    
    const form = document.getElementById('edit-user-form');
    form.querySelector('[name="user_id"]').value = user.id;
    form.querySelector('[name="first_name"]').value = user.first_name;
    form.querySelector('[name="last_name"]').value = user.last_name;
    form.querySelector('[name="email"]').value = user.email;
    form.querySelector('[name="phone"]').value = user.phone || '';
    form.querySelector('[name="is_active"]').value = user.is_active.toString();
    
    document.getElementById('edit-user-modal').style.display = 'block';
}

async function updateUser(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const userId = data.user_id;
    
    // Convert boolean
    data.is_active = data.is_active === 'true';
    
    try {
        await API.put(`/license-admin/users/${userId}`, data);
        showNotification('Usuario actualizado exitosamente', 'success');
        closeModal('edit-user-modal');
        loadUsers();
        
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification(error.message || 'Error al actualizar usuario', 'error');
    }
}

// View Center Stats
async function viewCenterStats(centerId) {
    try {
        const response = await API.get(`/license-admin/centers/${centerId}/stats`);
        const stats = response.stats;
        alert(`Estadísticas de ${stats.name}:\nInscritos: ${stats.current_enrollment}\nCapacidad: ${stats.max_capacity}`);
    } catch (error) {
        const center = centersCache[centerId];
        if (center) {
             alert(`Datos básicos:\nInscritos: ${center.current_enrollment}\nCapacidad: ${center.max_capacity}\n(Detalles completos no disponibles temporalmente)`);
        } else {
            showNotification('Error al cargar estadísticas', 'error');
        }
    }
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
    
    // Verify user has license_admin role
    const userData = Auth.getUserData();
    if (!userData || userData.role !== 'license_admin') {
        alert('Acceso denegado. Se requiere rol de License Admin.');
        Auth.logout();
        return;
    }
    
    loadDashboard();
    loadCenters(); // Pre-load centers for dropdowns
});

// ==================== CONSOLIDATED REPORTS ====================

async function loadConsolidatedReports() {
    try {
        const response = await API.get('/license-admin/reports/consolidated');
        
        // Update summary cards
        const summaryDiv = document.getElementById('consolidated-summary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="stat-card">
                    <h3>${response.total_centers || 0}</h3>
                    <p>Centros Totales</p>
                </div>
                <div class="stat-card">
                    <h3>${response.total_children || 0}</h3>
                    <p>Niños Inscritos</p>
                </div>
                <div class="stat-card">
                    <h3>${response.total_staff || 0}</h3>
                    <p>Personal Total</p>
                </div>
                <div class="stat-card">
                    <h3>${response.global_occupancy || 0}%</h3>
                    <p>Ocupación Global</p>
                </div>
            `;
        }
        
        // Load enrollment by center
        loadEnrollmentByCenter(response.enrollment_by_center || []);
        
        // Load staff distribution
        loadStaffDistribution(response.staff_distribution || []);
        
        // Load centers for filter
        loadCentersFilter(response.enrollment_by_center || []);
        
        // Load consolidated applications
        loadConsolidatedApplications();
        
    } catch (error) {
        console.error('Error loading consolidated reports:', error);
        showNotification('Error al cargar reportes consolidados', 'error');
    }
}

function loadEnrollmentByCenter(data) {
    const container = document.getElementById('enrollment-by-center');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">No hay datos disponibles</p>';
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: rgba(0,0,0,0.02); border-bottom: 2px solid var(--border-color);">
                <tr>
                    <th style="padding: 1rem; text-align: left;">Centro</th>
                    <th style="padding: 1rem; text-align: center;">Inscritos</th>
                    <th style="padding: 1rem; text-align: center;">Capacidad</th>
                    <th style="padding: 1rem; text-align: center;">Ocupación</th>
                    <th style="padding: 1rem; text-align: center;">Estado</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(center => {
                    const occupancy = center.capacity > 0 ? Math.round((center.enrolled / center.capacity) * 100) : 0;
                    return `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 1rem;">${center.center_name}</td>
                            <td style="padding: 1rem; text-align: center;">${center.enrolled}</td>
                            <td style="padding: 1rem; text-align: center;">${center.capacity}</td>
                            <td style="padding: 1rem; text-align: center;">
                                <div class="progress-bar" style="height: 20px; background: rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; margin: 0 auto; max-width: 150px;">
                                    <div style="height: 100%; width: ${occupancy}%; background: ${getOccupancyColor(occupancy)}; transition: width 0.3s;"></div>
                                </div>
                                <span style="font-weight: 700; margin-top: 0.25rem; display: block;">${occupancy}%</span>
                            </td>
                            <td style="padding: 1rem; text-align: center;">
                                <span class="badge badge-${center.status === 'activo' ? 'success' : 'secondary'}">
                                    ${center.status}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function loadStaffDistribution(data) {
    const container = document.getElementById('staff-distribution');
    if (!container) return;
    
    if (data.length === 0) {
        container.innerHTML = '<p class="text-center text-secondary">No hay datos disponibles</p>';
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: rgba(0,0,0,0.02); border-bottom: 2px solid var(--border-color);">
                <tr>
                    <th style="padding: 1rem; text-align: left;">Centro</th>
                    <th style="padding: 1rem; text-align: center;">Educadoras</th>
                    <th style="padding: 1rem; text-align: center;">Coordinadores</th>
                    <th style="padding: 1rem; text-align: center;">Otros</th>
                    <th style="padding: 1rem; text-align: center;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(center => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 1rem;">${center.center_name}</td>
                        <td style="padding: 1rem; text-align: center;">${center.educators || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${center.coordinators || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${center.others || 0}</td>
                        <td style="padding: 1rem; text-align: center; font-weight: 700;">${center.total || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function loadCentersFilter(centers) {
    const filter = document.getElementById('applications-center-filter');
    if (!filter) return;
    
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">Todos los centros</option>';
    
    centers.forEach(center => {
        const option = document.createElement('option');
        option.value = center.center_id;
        option.textContent = center.center_name;
        if (center.center_id == currentValue) {
            option.selected = true;
        }
        filter.appendChild(option);
    });
}

async function loadConsolidatedApplications() {
    const container = document.getElementById('consolidated-applications');
    if (!container) return;
    
    const centerFilter = document.getElementById('applications-center-filter')?.value || '';
    const statusFilter = document.getElementById('applications-status-filter')?.value || '';
    
    container.innerHTML = '<p class="text-center">Cargando...</p>';
    
    try {
        // This would need a new endpoint in the backend
        // For now, showing placeholder
        container.innerHTML = `
            <p class="text-center text-secondary">
                Funcionalidad de solicitudes consolidadas disponible próximamente.<br>
                Filtros seleccionados: Centro ${centerFilter || 'Todos'}, Estado ${statusFilter || 'Todos'}
            </p>
        `;
        
    } catch (error) {
        console.error('Error loading applications:', error);
        container.innerHTML = '<p class="text-center text-danger">Error al cargar solicitudes</p>';
    }
}

function getOccupancyColor(percentage) {
    if (percentage >= 90) return 'var(--danger)';
    if (percentage >= 75) return 'var(--warning)';
    if (percentage >= 50) return 'var(--info)';
    return 'var(--success)';
}

// Update showSection to load reports
const originalLicenseAdminShowSection = showSection;
showSection = function(sectionName) {
    originalLicenseAdminShowSection(sectionName);
    
    if (sectionName === 'reports') {
        loadConsolidatedReports();
    }
};
