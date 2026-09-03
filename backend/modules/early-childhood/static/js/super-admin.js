// Super Admin Dashboard JavaScript

// Cache for licenses
let licensesCache = {};

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
        case 'licenses':
            loadLicenses();
            break;
    }
}

// Load Dashboard
async function loadDashboard() {
    try {
        const response = await API.get('/super-admin/dashboard');
        
        document.getElementById('total-licenses').textContent = response.total_licenses;
        document.getElementById('active-licenses').textContent = response.active_licenses;
        document.getElementById('total-centers').textContent = response.total_centers;
        document.getElementById('expiring-licenses').textContent = response.licenses_expiring_soon;
        
        // Load licenses summary
        const licensesResponse = await API.get('/super-admin/licenses');
        const summaryDiv = document.getElementById('licenses-summary');
        summaryDiv.innerHTML = '';
        
        if (licensesResponse.licenses.length === 0) {
            summaryDiv.innerHTML = '<p class="empty-state">No hay licencias creadas</p>';
            return;
        }
        
        licensesResponse.licenses.forEach(license => {
            const card = document.createElement('div');
            // Changed from license-summary-card to glass-card for modern design
            card.className = 'glass-card mb-2';
            card.style.padding = '1.5rem';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.1rem; font-weight: 600;">${license.name}</h3>
                    <span class="badge badge-${license.status === 'active' ? 'success' : 'warning'}">
                        ${license.status === 'active' ? 'Activa' : 'Suspendida'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
                    <p><strong style="color: var(--text-secondary);">Centros:</strong> ${license.active_centers} / ${license.max_centers}</p>
                    <p><strong style="color: var(--text-secondary);">Vigencia:</strong> ${license.start_date} - ${license.end_date}</p>
                </div>
            `;
            summaryDiv.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error al cargar el dashboard', 'error');
    }
}

// Load Licenses
async function loadLicenses() {
    try {
        const response = await API.get('/super-admin/licenses');
        const listDiv = document.getElementById('licenses-list');
        listDiv.innerHTML = '';
        
        // Update Cache
        licensesCache = {}; // Reset cache
        
        if (response.licenses.length === 0) {
            listDiv.innerHTML = '<div class="glass-card empty-state"><p>No hay licencias creadas. Crea tu primera licencia.</p></div>';
            return;
        }
        
        response.licenses.forEach(license => {
            // Store in cache
            licensesCache[license.id] = license;
            
            const card = document.createElement('div');
            // Changed from license-card to glass-card
            card.className = 'glass-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                    <div>
                        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">${license.name}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">${license.description || 'Sin descripción'}</p>
                    </div>
                    <span class="badge badge-${license.status === 'active' ? 'success' : 'warning'}">
                        ${license.status === 'active' ? 'Activa' : 'Suspendida'}
                    </span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
                    <div>
                        <span style="display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Centros</span>
                        <span style="font-weight: 600;">${license.active_centers} / ${license.max_centers}</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(license.active_centers / license.max_centers * 100)}%"></div>
                        </div>
                    </div>
                    <div>
                        <span style="display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Vigencia</span>
                        <span style="font-weight: 600;">${license.start_date} - ${license.end_date}</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.25rem;">Estado</span>
                        <span style="font-weight: 600; color: ${license.is_expired ? 'var(--danger)' : 'var(--success)'}">
                            ${license.is_expired ? '⚠️ Expirada' : '✅ Vigente'}
                        </span>
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: 0; padding-top: 1.5rem;">
                    <button class="btn btn-secondary btn-sm" onclick="viewLicenseDetails(${license.id})">
                        👁️ Ver Detalles
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="editLicense(${license.id})">
                        ✏️ Editar
                    </button>
                    ${license.active_centers === 0 ? 
                        `<button class="btn btn-danger btn-sm" onclick="deleteLicense(${license.id})">
                            🗑️ Eliminar
                        </button>` : 
                        ''}
                </div>
            `;
            listDiv.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading licenses:', error);
        showNotification('Error al cargar licencias', 'error');
    }
}

// Create License with Admin
function showCreateLicenseModal() {
    document.getElementById('create-license-modal').style.display = 'block';
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    document.querySelector('[name="start_date"]').value = today;
    document.querySelector('[name="end_date"]').value = oneYearLater.toISOString().split('T')[0];
}

async function createLicense(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Separate license data from admin data
    const licenseData = {
        name: data.name,
        description: data.description,
        max_centers: parseInt(data.max_centers),
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date
    };
    
    const adminData = {
        first_name: data.admin_first_name,
        last_name: data.admin_last_name,
        email: data.admin_email,
        phone: data.admin_phone,
        password: data.admin_password
    };
    
    try {
        // Step 1: Create License
        showNotification('Creando licencia...', 'info');
        const licenseResponse = await API.post('/super-admin/licenses', licenseData);
        const licenseId = licenseResponse.license.id;
        
        // Step 2: Create Admin User
        showNotification('Creando usuario administrador...', 'info');
        const userResponse = await API.post('/super-admin/create-license-admin', {
            license_id: licenseId,
            ...adminData
        });
        
        showNotification('Licencia y administrador creados exitosamente', 'success');
        closeModal('create-license-modal');
        event.target.reset();
        loadLicenses();
        loadDashboard();
        
    } catch (error) {
        console.error('Error creating license:', error);
        showNotification(error.message || 'Error al crear licencia', 'error');
    }
}

// View License Details
async function viewLicenseDetails(licenseId) {
    // 1. Show Instant Loading State
    const contentDiv = document.getElementById('license-details-content');
    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 4rem;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">⌛</div>
            <p>Cargando detalles...</p>
        </div>
    `;
    document.getElementById('view-license-modal').style.display = 'block';

    // 2. Fetch Data
    try {
        const response = await API.get(`/super-admin/licenses/${licenseId}`);
        const license = response.license;
        
        const detailsHtml = `
            <h2 style="margin-bottom: 2rem;">${license.name}</h2>
            <div style="display: grid; gap: 2rem;">
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem;">Información General</h3>
                    <p class="mb-2"><strong>Descripción:</strong> ${license.description || 'N/A'}</p>
                    <p class="mb-2"><strong>Centros:</strong> ${license.active_centers} / ${license.max_centers}</p>
                    <p class="mb-2"><strong>Vigencia:</strong> ${license.start_date} - ${license.end_date}</p>
                    <p class="mb-2"><strong>Estado:</strong> 
                        <span class="badge badge-${license.status === 'active' ? 'success' : 'warning'}">
                            ${license.status === 'active' ? 'Activa' : 'Suspendida'}
                        </span>
                    </p>
                </div>
                
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem;">Administradores (${license.admins.length})</h3>
                    ${license.admins.length > 0 ? `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <th style="text-align: left; padding: 0.5rem;">Nombre</th>
                                    <th style="text-align: left; padding: 0.5rem;">Email</th>
                                    <th style="text-align: left; padding: 0.5rem;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${license.admins.map(admin => `
                                    <tr>
                                        <td style="padding: 0.5rem;">${admin.user_name}</td>
                                        <td style="padding: 0.5rem;">${admin.user_email}</td>
                                        <td style="padding: 0.5rem;">
                                            <span class="badge badge-${admin.is_active ? 'success' : 'danger'}">
                                                ${admin.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="empty-state">No hay administradores asignados</p>'}
                </div>
                
                <div class="glass-card">
                    <h3 style="margin-bottom: 1rem;">Centros Asociados (${license.centers.length})</h3>
                    ${license.centers.length > 0 ? `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <th style="text-align: left; padding: 0.5rem;">Nombre</th>
                                    <th style="text-align: left; padding: 0.5rem;">Ubicación</th>
                                    <th style="text-align: left; padding: 0.5rem;">Capacidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${license.centers.map(center => `
                                    <tr>
                                        <td style="padding: 0.5rem;">${center.name}</td>
                                        <td style="padding: 0.5rem;">${center.city}, ${center.province}</td>
                                        <td style="padding: 0.5rem;">${center.current_enrollment} / ${center.max_capacity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="empty-state">No hay centros creados aún</p>'}
                </div>
            </div>
            <div style="margin-top: 2rem; text-align: right;">
                <button class="btn btn-secondary" onclick="closeModal('view-license-modal')">Cerrar</button>
            </div>
        `;
        
        contentDiv.innerHTML = detailsHtml;
        
    } catch (error) {
        console.error('Error viewing license:', error);
        contentDiv.innerHTML = `<p class="empty-state" style="color: var(--danger)">Error al cargar detalles: ${error.message}</p>`;
    }
}

// Edit License (Optimized: Instant Load)
function editLicense(licenseId) {
    const license = licensesCache[licenseId];
    
    if (!license) {
        showNotification('Error: Licencia no encontrada en caché', 'error');
        // Fallback to API if really needed, but cache should work
        return;
    }
    
    const form = document.getElementById('edit-license-form');
    form.querySelector('[name="license_id"]').value = license.id;
    form.querySelector('[name="name"]').value = license.name;
    form.querySelector('[name="description"]').value = license.description || '';
    form.querySelector('[name="status"]').value = license.status;
    form.querySelector('[name="max_centers"]').value = license.max_centers;
    form.querySelector('[name="start_date"]').value = license.start_date;
    form.querySelector('[name="end_date"]').value = license.end_date;
    
    document.getElementById('edit-license-modal').style.display = 'block';
}

async function updateLicense(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const licenseId = data.license_id;
    
    // Formatting data
    const updateData = {
        name: data.name,
        description: data.description,
        status: data.status,
        max_centers: parseInt(data.max_centers),
        start_date: data.start_date,
        end_date: data.end_date
    };
    
    try {
        await API.put(`/super-admin/licenses/${licenseId}`, updateData);
        showNotification('Licencia actualizada exitosamente', 'success');
        closeModal('edit-license-modal');
        loadLicenses();
        loadDashboard(); // Refresh stats
        
    } catch (error) {
        console.error('Error updating license:', error);
        showNotification(error.message || 'Error al actualizar licencia', 'error');
    }
}

// Delete License
async function deleteLicense(licenseId) {
    if (!confirm('¿Está seguro de eliminar esta licencia? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        await API.delete(`/super-admin/licenses/${licenseId}`);
        showNotification('Licencia eliminada exitosamente', 'success');
        loadLicenses();
        loadDashboard();
        
    } catch (error) {
        console.error('Error deleting license:', error);
        showNotification(error.message || 'Error al eliminar licencia', 'error');
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
    
    // Verify user has super_admin role
    const userData = Auth.getUserData();
    if (!userData || userData.role !== 'super_admin') {
        alert('Acceso denegado. Se requiere rol de Super Admin.');
        Auth.logout();
        return;
    }
    
    loadDashboard();
});
