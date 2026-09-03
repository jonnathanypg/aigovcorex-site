// Enhanced Attendance and Nutrition for Educator

// ==================== ENHANCED ATTENDANCE ====================

async function loadEnhancedAttendance() {
    const dateSpan = document.getElementById('attendance-date');
    const grid = document.getElementById('attendance-grid');

    if (!dateSpan || !grid) return;

    const today = new Date().toISOString().split('T')[0];
    dateSpan.textContent = new Date().toLocaleDateString();

    grid.innerHTML = '<p class="text-center">Cargando...</p>';

    try {
        // Load children
        const childrenResponse = await API.get('/educator/children');
        const children = childrenResponse.children;

        // Load today's attendance
        const attendanceResponse = await API.get(`/educator/attendance?date=${today}`);
        const attendanceMap = {};

        attendanceResponse.attendance.forEach(att => {
            attendanceMap[att.child_id] = att;
        });

        grid.innerHTML = '';

        children.forEach(child => {
            const attendance = attendanceMap[child.id] || {};
            const card = createAttendanceCard(child, attendance);
            grid.appendChild(card);
        });

        // Load alerts
        loadAttendanceAlerts();

    } catch (error) {
        console.error('Error loading attendance:', error);
        grid.innerHTML = '<p class="text-center text-danger">Error al cargar asistencia</p>';
    }
}

function createAttendanceCard(child, attendance) {
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.id = `attendance-card-${child.id}`;

    const isPresent = attendance.status === 'presente';
    const hasCheckedIn = attendance.arrival_time;
    const hasCheckedOut = attendance.departure_time;

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <h4 style="margin: 0;">${child.full_name}</h4>
            <span class="badge badge-${getAttendanceStatusBadge(attendance.status)}">
                ${getAttendanceStatusLabel(attendance.status)}
            </span>
        </div>
        
        <!-- Quick Actions -->
        <div class="quick-actions" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <button class="btn btn-sm ${hasCheckedIn ? 'btn-secondary' : 'btn-primary'}" 
                onclick="quickCheckIn(${child.id})" ${hasCheckedIn ? 'disabled' : ''}>
                ✓ Check-in
            </button>
            <button class="btn btn-sm ${hasCheckedOut ? 'btn-secondary' : 'btn-primary'}" 
                onclick="quickCheckOut(${child.id})" ${!hasCheckedIn || hasCheckedOut ? 'disabled' : ''}>
                → Check-out
            </button>
        </div>
        
        <!-- Detailed Fields -->
        <div class="attendance-details">
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 0.85rem; color: var(--text-secondary);">Hora Llegada</label>
                    <input type="time" id="arrival-${child.id}" value="${attendance.arrival_time || ''}" 
                        style="padding: 0.5rem; border-radius: 5px; border: 1px solid var(--border-color); width: 100%;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 0.85rem; color: var(--text-secondary);">Hora Salida</label>
                    <input type="time" id="departure-${child.id}" value="${attendance.departure_time || ''}"
                        style="padding: 0.5rem; border-radius: 5px; border: 1px solid var(--border-color); width: 100%;">
                </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 0.5rem;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">Recogido por</label>
                <input type="text" id="picked-by-${child.id}" value="${attendance.picked_up_by || ''}" 
                    placeholder="Nombre de quien recoge"
                    style="padding: 0.5rem; border-radius: 5px; border: 1px solid var(--border-color); width: 100%;">
            </div>
            
            <div class="form-group" style="margin: 0;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">Notas del día</label>
                <textarea id="notes-${child.id}" rows="2" placeholder="Observaciones..."
                    style="padding: 0.5rem; border-radius: 5px; border: 1px solid var(--border-color); width: 100%; resize: vertical;">${attendance.notes || ''}</textarea>
            </div>
        </div>
    `;

    return card;
}

function getAttendanceStatusBadge(status) {
    const badges = {
        'presente': 'success',
        'ausente': 'danger',
        'justificado': 'warning',
        'tardanza': 'info'
    };
    return badges[status] || 'secondary';
}

function getAttendanceStatusLabel(status) {
    const labels = {
        'presente': 'Presente',
        'ausente': 'Ausente',
        'justificado': 'Justificado',
        'tardanza': 'Tardanza'
    };
    return labels[status] || 'Sin registro';
}

async function quickCheckIn(childId) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5); // HH:MM

    try {
        await API.post('/educator/attendance/quick-checkin', {
            child_id: childId,
            arrival_time: time
        });

        showNotification('Check-in registrado', 'success');

        // Update UI
        document.getElementById(`arrival-${childId}`).value = time;
        loadEnhancedAttendance(); // Reload to update buttons

    } catch (error) {
        console.error('Error in check-in:', error);
        showNotification(error.message || 'Error al registrar check-in', 'error');
    }
}

async function quickCheckOut(childId) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const pickedBy = prompt('¿Quién recoge al niño?');

    if (!pickedBy) return;

    try {
        await API.post('/educator/attendance/quick-checkout', {
            child_id: childId,
            departure_time: time,
            picked_up_by: pickedBy
        });

        showNotification('Check-out registrado', 'success');

        // Update UI
        document.getElementById(`departure-${childId}`).value = time;
        document.getElementById(`picked-by-${childId}`).value = pickedBy;
        loadEnhancedAttendance();

    } catch (error) {
        console.error('Error in check-out:', error);
        showNotification(error.message || 'Error al registrar check-out', 'error');
    }
}

async function saveAllAttendance() {
    const today = new Date().toISOString().split('T')[0];

    try {
        const childrenResponse = await API.get('/educator/children');
        const children = childrenResponse.children;

        const attendanceData = [];

        for (const child of children) {
            const arrival = document.getElementById(`arrival-${child.id}`).value;
            const departure = document.getElementById(`departure-${child.id}`).value;
            const pickedBy = document.getElementById(`picked-by-${child.id}`).value;
            const notes = document.getElementById(`notes-${child.id}`).value;

            if (arrival || departure || notes) {
                attendanceData.push({
                    child_id: child.id,
                    date: today,
                    arrival_time: arrival || null,
                    departure_time: departure || null,
                    picked_up_by: pickedBy || null,
                    status: arrival ? 'presente' : 'ausente',
                    notes: notes || null
                });
            }
        }

        await API.post('/educator/attendance', { attendance: attendanceData });
        showNotification('Asistencia guardada exitosamente', 'success');

    } catch (error) {
        console.error('Error saving attendance:', error);
        showNotification(error.message || 'Error al guardar asistencia', 'error');
    }
}

async function loadAttendanceAlerts() {
    try {
        const response = await API.get('/educator/attendance/alerts');
        const alerts = response.alerts;

        const section = document.getElementById('attendance-alerts-section');
        const list = document.getElementById('attendance-alerts-list');

        if (alerts.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = alerts.map(alert => `
            <div class="glass-card mb-2" style="border-left: 4px solid var(--${alert.severity === 'high' ? 'danger' : 'warning'});">
                <h4>${alert.child_name}</h4>
                <p style="color: var(--text-secondary);">
                    ${alert.absences_count} ausencias en los últimos 30 días
                </p>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

// ==================== NUTRITION ====================

async function loadNutrition() {
    loadDailyMenu();
    loadNutritionGrid();
}

async function loadDailyMenu() {
    const menuDiv = document.getElementById('daily-menu');
    if (!menuDiv) return;

    menuDiv.innerHTML = '<p class="text-center">Cargando menú...</p>';

    try {
        const response = await API.get('/nutrition/menu/today');
        const meals = response.meals;

        const mealTypes = [
            { key: 'desayuno', icon: '🌅', label: 'Desayuno' },
            { key: 'almuerzo', icon: '🍽️', label: 'Almuerzo' },
            { key: 'merienda', icon: '🍪', label: 'Merienda' }
        ];

        menuDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                ${mealTypes.map(meal => {
            const menuItem = meals[meal.key];
            return `
                        <div class="meal-card glass-card">
                            <h4>${meal.icon} ${meal.label}</h4>
                            <p>${menuItem ? menuItem.description : 'Sin definir'}</p>
                            ${menuItem && menuItem.ingredients ? `
                                <p class="text-secondary" style="font-size: 0.85rem;">
                                    ${menuItem.ingredients.join(', ')}
                                </p>
                            ` : ''}
                        </div>
                    `;
        }).join('')}
            </div>
        `;

    } catch (error) {
        console.error('Error loading menu:', error);
        // Fallback to placeholder
        menuDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                <div class="meal-card glass-card">
                    <h4>🌅 Desayuno</h4>
                    <p>Menú no configurado</p>
                </div>
                <div class="meal-card glass-card">
                    <h4>🍽️ Almuerzo</h4>
                    <p>Menú no configurado</p>
                </div>
                <div class="meal-card glass-card">
                    <h4>🍪 Merienda</h4>
                    <p>Menú no configurado</p>
                </div>
            </div>
        `;
    }
}

async function loadNutritionGrid() {
    const grid = document.getElementById('nutrition-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="text-center">Cargando...</p>';

    try {
        const response = await API.get('/educator/children');
        const children = response.children;

        grid.innerHTML = '';

        children.forEach(child => {
            const card = createNutritionCard(child);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading nutrition:', error);
        grid.innerHTML = '<p class="text-center text-danger">Error al cargar datos</p>';
    }
}

function createNutritionCard(child) {
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.id = `nutrition-card-${child.id}`;

    card.innerHTML = `
        <h4 style="margin-bottom: 1rem;">${child.full_name}</h4>
        
        <div class="meal-checks">
            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input type="checkbox" id="breakfast-${child.id}" checked>
                <span>Desayuno</span>
                <select id="breakfast-qty-${child.id}" style="margin-left: auto; padding: 0.25rem; border-radius: 5px;">
                    <option value="100">Todo</option>
                    <option value="75">3/4</option>
                    <option value="50">1/2</option>
                    <option value="25">1/4</option>
                    <option value="0">Nada</option>
                </select>
            </label>
            
            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input type="checkbox" id="lunch-${child.id}" checked>
                <span>Almuerzo</span>
                <select id="lunch-qty-${child.id}" style="margin-left: auto; padding: 0.25rem; border-radius: 5px;">
                    <option value="100">Todo</option>
                    <option value="75">3/4</option>
                    <option value="50">1/2</option>
                    <option value="25">1/4</option>
                    <option value="0">Nada</option>
                </select>
            </label>
            
            <label style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="snack-${child.id}" checked>
                <span>Merienda</span>
                <select id="snack-qty-${child.id}" style="margin-left: auto; padding: 0.25rem; border-radius: 5px;">
                    <option value="100">Todo</option>
                    <option value="75">3/4</option>
                    <option value="50">1/2</option>
                    <option value="25">1/4</option>
                    <option value="0">Nada</option>
                </select>
            </label>
        </div>
    `;

    return card;
}

async function saveNutritionData() {
    try {
        const response = await API.get('/educator/children');
        const children = response.children;

        const today = new Date().toISOString().split('T')[0];
        const mealTypes = ['desayuno', 'almuerzo', 'merienda'];
        const mealPrefixes = ['breakfast', 'lunch', 'snack'];

        let savedCount = 0;

        for (let i = 0; i < mealTypes.length; i++) {
            const mealType = mealTypes[i];
            const prefix = mealPrefixes[i];

            const rations = [];

            for (const child of children) {
                const checkbox = document.getElementById(`${prefix}-${child.id}`);
                const select = document.getElementById(`${prefix}-qty-${child.id}`);

                if (checkbox && checkbox.checked && select) {
                    rations.push({
                        child_id: child.id,
                        quantity: parseInt(select.value)
                    });
                }
            }

            if (rations.length > 0) {
                await API.post('/nutrition/rations/bulk', {
                    date: today,
                    meal_type: mealType,
                    rations: rations
                });
                savedCount += rations.length;
            }
        }

        showNotification(`${savedCount} registros de nutrición guardados`, 'success');

    } catch (error) {
        console.error('Error saving nutrition:', error);
        showNotification(error.message || 'Error al guardar nutrición', 'error');
    }
}

// Override loadAttendance to use enhanced version
const originalLoadAttendance = window.loadAttendance;
window.loadAttendance = loadEnhancedAttendance;

