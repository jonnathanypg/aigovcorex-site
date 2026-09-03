// Educator Dashboard JavaScript

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
        case 'my-group':
            loadMyGroup();
            break;
        case 'attendance':
            loadAttendance();
            break;
        case 'activities':
            loadActivities();
            break;
    }
}

// Load Dashboard
async function loadDashboard() {
    try {
        const response = await API.get('/educator/dashboard');

        // Update educator name
        document.getElementById('educator-name').textContent = response.educator.name;

        // Update stats
        document.getElementById('my-children-count').textContent = response.stats.my_children_count;
        document.getElementById('present-today').textContent = response.stats.present_today;
        document.getElementById('absent-today').textContent = response.stats.absent_today;
        document.getElementById('pending-activities').textContent = response.stats.pending_activities;

        // Load daily summary
        loadDailySummary();

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error al cargar el dashboard', 'error');
    }
}

async function loadDailySummary() {
    try {
        const response = await API.get('/educator/summary');
        const summaryDiv = document.getElementById('daily-summary');

        const summary = response.summary;

        summaryDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 10px;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--success);">Presentes</h4>
                    <p style="font-size: 1.5rem; font-weight: 600;">${summary.attendance.present}</p>
                </div>
                <div style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 10px;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--danger);">Ausentes</h4>
                    <p style="font-size: 1.5rem; font-weight: 600;">${summary.attendance.absent}</p>
                </div>
                <div style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 10px;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--warning);">Justificados</h4>
                    <p style="font-size: 1.5rem; font-weight: 600;">${summary.attendance.excused}</p>
                </div>
                <div style="background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 10px;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--primary);">Actividades</h4>
                    <p style="font-size: 1.5rem; font-weight: 600;">${summary.activities_completed}</p>
                </div>
            </div>
            <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.02); border-radius: 10px;">
                <h4 style="margin-bottom: 0.5rem;">Notas del Día</h4>
                <p style="color: var(--text-secondary);">${summary.notes}</p>
            </div>
        `;

    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Load My Group
async function loadMyGroup() {
    try {
        const response = await API.get('/educator/children');
        const grid = document.getElementById('children-grid');
        grid.innerHTML = '';

        if (response.children.length === 0) {
            grid.innerHTML = '<div class="glass-card empty-state" style="grid-column: 1/-1;"><p>No hay niños asignados a tu grupo</p></div>';
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

// Load Attendance
let attendanceData = [];

async function loadAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('attendance-date').textContent = today;

        const response = await API.get(`/educator/attendance?date=${today}`);
        attendanceData = response.attendance;

        const tbody = document.getElementById('attendance-tbody');
        tbody.innerHTML = '';

        if (attendanceData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem;">No hay niños para registrar asistencia</td></tr>';
            return;
        }

        attendanceData.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            tr.innerHTML = `
                <td style="padding: 1rem;">${item.child_name}</td>
                <td style="padding: 1rem; text-align: center;">
                    <input type="radio" name="attendance_${item.child_id}" value="present" 
                        ${item.status === 'present' ? 'checked' : ''} 
                        onchange="updateAttendanceStatus(${index}, 'present')">
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <input type="radio" name="attendance_${item.child_id}" value="absent" 
                        ${item.status === 'absent' ? 'checked' : ''} 
                        onchange="updateAttendanceStatus(${index}, 'absent')">
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <input type="radio" name="attendance_${item.child_id}" value="excused" 
                        ${item.status === 'excused' ? 'checked' : ''} 
                        onchange="updateAttendanceStatus(${index}, 'excused')">
                </td>
                <td style="padding: 1rem;">
                    <input type="text" placeholder="Notas..." value="${item.notes || ''}" 
                        onchange="updateAttendanceNotes(${index}, this.value)"
                        style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 5px;">
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading attendance:', error);
        showNotification('Error al cargar asistencia', 'error');
    }
}

function updateAttendanceStatus(index, status) {
    attendanceData[index].status = status;
}

function updateAttendanceNotes(index, notes) {
    attendanceData[index].notes = notes;
}

async function saveAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];

        await API.post('/educator/attendance', {
            date: today,
            attendance: attendanceData
        });

        showNotification('Asistencia guardada exitosamente', 'success');
        loadDashboard(); // Refresh stats

    } catch (error) {
        console.error('Error saving attendance:', error);
        showNotification(error.message || 'Error al guardar asistencia', 'error');
    }
}

// Load Activities
async function loadActivities() {
    try {
        const response = await API.get('/educator/activities');
        const listDiv = document.getElementById('activities-list');
        listDiv.innerHTML = '';

        if (response.activities.length === 0) {
            listDiv.innerHTML = '<div class="glass-card empty-state"><p>No hay actividades registradas</p></div>';
            return;
        }

        response.activities.forEach(activity => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">${activity.title}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">${activity.description}</p>
                    </div>
                    <span class="badge badge-info">${formatActivityType(activity.activity_type)}</span>
                </div>
                <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                    <span>📅 ${activity.date}</span>
                    <span>👩‍🏫 ${activity.educator_name}</span>
                </div>
            `;
            listDiv.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading activities:', error);
        showNotification('Error al cargar actividades', 'error');
    }
}

function formatActivityType(type) {
    const types = {
        'pedagogica': 'Pedagógica',
        'recreativa': 'Recreativa',
        'artistica': 'Artística',
        'fisica': 'Física',
        'social': 'Social'
    };
    return types[type] || type;
}

// Add Activity
function showAddActivityModal() {
    document.getElementById('add-activity-modal').style.display = 'block';
}

async function addActivity(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
        await API.post('/educator/activities', data);
        showNotification('Actividad registrada exitosamente', 'success');
        closeModal('add-activity-modal');
        event.target.reset();
        loadActivities();

    } catch (error) {
        console.error('Error adding activity:', error);
        showNotification(error.message || 'Error al registrar actividad', 'error');
    }
}

function viewChildProfile(childId) {
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

    // Verify user has educator role
    const userData = Auth.getUserData();
    if (!userData || userData.role !== 'educadora') {
        alert('Acceso denegado. Se requiere rol de Educadora.');
        Auth.logout();
        return;
    }

    loadDashboard();
});

// Add nutrition to showSection
const originalShowSection = showSection;
showSection = function (sectionName) {
    originalShowSection(sectionName);

    if (sectionName === 'nutrition') {
        loadNutrition();
    } else if (sectionName === 'attendance') {
        loadEnhancedAttendance();
    }
};

// Milestones integration for educator
function showChildMilestones(childId, childName, ageMonths) {
    milestonesManager.showMilestonesModal(childId, childName, ageMonths);
}
