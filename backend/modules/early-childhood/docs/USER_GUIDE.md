# User Guide - KindiCore AI

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Managing Children](#managing-children)
4. [Attendance Tracking](#attendance-tracking)
5. [Nutrition Logging](#nutrition-logging)
6. [AI Assistant](#ai-assistant)
7. [Reports](#reports)

---

## Getting Started

### First Login

1. Open your browser and go to `http://localhost:5000`
2. Enter your credentials:
   - **Email:** admin@cdi.ec
   - **Password:** admin123
3. Click "Iniciar Sesión"

> ⚠️ **Important:** Change the default password immediately after first login!

### User Roles

The system has 4 user roles:

- **Admin Global** - Full system access, manages all centers
- **Coordinador** - Manages one CDI center, validates data, generates reports
- **Educadora** - Daily operations: attendance, nutrition, health logging
- **Administrativo** - Billing, inventory, administrative reports

---

## Dashboard

The dashboard is your home page showing:

### Statistics Cards
- **Niños Activos** - Total active children
- **Asistencia Hoy** - Today's attendance count
- **Reportes Pendientes** - Pending reports
- **Educadoras Activas** - Active educators

### Quick Actions
- Register Attendance
- Log Nutrition
- View Children
- Generate Reports

### AI Assistant
Chat with the AI to perform tasks using natural language.

### Recent Activity
Shows recent system activities and updates.

---

## Managing Children

### Viewing Children List

1. Click **"Niños"** in the navigation menu
2. Use the search box to find specific children
3. Filter by status: Activo, Inactivo, Egresado
4. Click **"Ver Perfil"** to see detailed information

### Adding a New Child

1. Go to **Niños** page
2. Click **"+ Agregar Niño"**
3. Fill in the required information:
   - First Name, Last Name
   - Birth Date
   - Gender
   - Enrollment Date
   - Blood Type (optional)
   - Allergies (if any)
   - Medical Conditions (if any)
4. Click **"Guardar"**

### Child Profile

The child profile shows:
- **Personal Information:** Age, birth date, gender, blood type
- **Academic Information:** Assigned group, enrollment date
- **Medical Alerts:** Allergies and medical conditions
- **Recent Records:** Attendance, nutrition, health, development

---

## Attendance Tracking

### Daily Attendance Registration

1. Click **"Asistencia"** in the menu
2. Select the date (defaults to today)
3. For each child, select their status:
   - **Presente** - Child attended
   - **Ausente** - Child absent
   - **Justificado** - Absence justified
   - **Tardanza** - Late arrival
4. Click **"Guardar Todo"** to save all attendance

### Viewing Attendance History

1. Go to Attendance page
2. Change the date to view past records
3. Export to Excel if needed

---

## Nutrition Logging

### Recording Meals

1. Click **"Nutrición"** in the menu
2. Select the child from dropdown
3. Choose meal type:
   - Desayuno (Breakfast)
   - Refrigerio AM (Morning Snack)
   - Almuerzo (Lunch)
   - Refrigerio PM (Afternoon Snack)
   - Lactancia (Breastfeeding)
4. Select consumption level:
   - Todo (100%)
   - La Mayoría (75%)
   - La Mitad (50%)
   - Poco (25%)
   - Nada (0%)
5. Add observations if needed
6. Click **"Registrar"**

### Nutrition Guidelines

According to MIES standards:
- CDI provides **70% of daily nutritional requirements**
- **4 meal times** per day
- Age-specific caloric requirements:
  - 12-24 months: 800-1000 Kcal
  - 24-36 months: 1000-1200 Kcal

---

## AI Assistant

### Using the Chat

The AI Assistant can help you with:

#### Recording Data
```
"Hoy María comió todo su almuerzo pero tuvo diarrea"
→ Registers nutrition and health automatically
```

#### Managing Attendance
```
"Asistieron: Juan, Pedro, Sofía. Faltó Daniel"
→ Marks attendance for all mentioned children
```

#### Getting Summaries
```
"Dame un resumen del desarrollo de Sofía este mes"
→ Generates development report
```

#### Finding Contacts
```
"Necesito el contacto de emergencia de María"
→ Shows emergency contact information
```

### Chat Tips

- Be specific with child names
- Use natural language
- The AI remembers context within conversation
- If unsure, the AI will ask for clarification

---

## Reports

### Daily Reports

1. Go to **"Reportes"** page
2. Click **"Reporte Diario"**
3. Select date range
4. Click **"Generar"**
5. Download as PDF or Excel

### Monthly Reports

1. Go to **"Reportes"** page
2. Click **"Reporte Mensual"**
3. Select month
4. Choose report type:
   - Attendance Summary
   - Nutrition Analysis
   - Health Overview
   - Development Progress
5. Click **"Generar"**

### Child-Specific Reports

1. Go to child's profile
2. Click **"Generar Reporte"**
3. Select report type and date range
4. Download report

### Automated Reports

The system automatically:
- Sends daily summaries to parents at 5:30 PM
- Generates monthly reports for MIES
- Creates development progress reports quarterly

---

## Best Practices

### Daily Routine

**Morning (8:00 AM - 9:00 AM)**
1. Register attendance as children arrive
2. Note any special conditions or alerts

**During Meals**
1. Log nutrition immediately after each meal
2. Note consumption levels accurately
3. Report any food-related incidents

**Throughout Day**
1. Use AI chat for quick data entry
2. Record health incidents immediately
3. Note development milestones as observed

**End of Day (5:00 PM)**
1. Review all records for completeness
2. Verify attendance is marked for all children
3. Check automated reports were sent

### Data Quality

- ✅ **Be consistent** - Use the same terminology
- ✅ **Be timely** - Record data as events happen
- ✅ **Be accurate** - Double-check important information
- ✅ **Be complete** - Fill all required fields
- ✅ **Be specific** - Add notes for unusual situations

---

## Troubleshooting

### Can't Login
- Verify email and password
- Check CAPS LOCK is off
- Contact administrator to reset password

### Data Not Saving
- Check internet connection
- Verify you have permission for that action
- Try refreshing the page
- Contact technical support

### AI Not Responding
- Check your message is clear
- Verify child name is correct
- Try rephrasing your request
- Use manual entry if AI is unavailable

---

## Support

For technical support:
- Email: soporte@kindicore.ai
- Phone: 1-800-KINDI-AI
- Hours: Monday-Friday, 8:00 AM - 6:00 PM

For urgent issues:
- Contact your center coordinator
- Use manual data entry as backup
