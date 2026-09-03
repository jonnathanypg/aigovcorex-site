// Multi-Step Application Form JavaScript

class ApplicationFormWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.formData = {
            child: {},
            family: {},
            representatives: [],
            vulnerability: {}
        };
    }

    init() {
        this.showStep(1);
    }

    showStep(step) {
        // Hide all steps
        for (let i = 1; i <= this.totalSteps; i++) {
            const stepEl = document.getElementById(`step-${i}`);
            if (stepEl) stepEl.style.display = 'none';
        }

        // Show current step
        const currentStepEl = document.getElementById(`step-${step}`);
        if (currentStepEl) currentStepEl.style.display = 'block';

        // Update progress bar
        this.updateProgressBar(step);

        // Update buttons
        this.updateButtons(step);

        this.currentStep = step;
    }

    updateProgressBar(step) {
        const progress = (step / this.totalSteps) * 100;
        const progressBar = document.getElementById('form-progress-bar');
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }

        // Update step indicators
        for (let i = 1; i <= this.totalSteps; i++) {
            const indicator = document.getElementById(`step-indicator-${i}`);
            if (indicator) {
                if (i < step) {
                    indicator.className = 'step-indicator completed';
                } else if (i === step) {
                    indicator.className = 'step-indicator active';
                } else {
                    indicator.className = 'step-indicator';
                }
            }
        }
    }

    updateButtons(step) {
        const prevBtn = document.getElementById('prev-step-btn');
        const nextBtn = document.getElementById('next-step-btn');
        const submitBtn = document.getElementById('submit-application-btn');

        if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-block';
        if (nextBtn) nextBtn.style.display = step === this.totalSteps ? 'none' : 'inline-block';
        if (submitBtn) submitBtn.style.display = step === this.totalSteps ? 'inline-block' : 'none';
    }

    nextStep() {
        if (this.validateStep(this.currentStep)) {
            this.saveStepData(this.currentStep);
            if (this.currentStep < this.totalSteps) {
                this.showStep(this.currentStep + 1);
            }
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.showStep(this.currentStep - 1);
        }
    }

    validateStep(step) {
        const stepEl = document.getElementById(`step-${step}`);
        if (!stepEl) return true;

        // Custom validation for step 3 (Representatives)
        if (step === 3) {
            const repsContainer = document.getElementById('representatives-list');
            if (!repsContainer || repsContainer.children.length === 0) {
                showNotification('Debe agregar al menos un representante', 'error');
                return false;
            }

            // Validate each representative card
            let allValid = true;
            const repCards = repsContainer.querySelectorAll('.representative-card');

            repCards.forEach((card, index) => {
                const inputs = card.querySelectorAll('input[required], select[required]');
                inputs.forEach(input => {
                    if (!input.value.trim()) {
                        input.style.borderColor = 'var(--danger)';
                        allValid = false;
                    } else {
                        input.style.borderColor = '';
                    }
                });
            });

            if (!allValid) {
                showNotification('Por favor complete todos los campos requeridos de los representantes', 'error');
            }

            return allValid;
        }

        // Standard validation for other steps
        const inputs = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            // Check if input is visible (to avoid validating hidden fields)
            if (input.offsetParent !== null && !input.value.trim()) {
                input.style.borderColor = 'var(--danger)';
                isValid = false;
            } else {
                input.style.borderColor = '';
            }
        });

        if (!isValid) {
            showNotification('Por favor complete todos los campos requeridos', 'error');
        }

        return isValid;
    }

    saveStepData(step) {
        if (step === 3) {
            this.saveRepresentatives();
            return;
        }

        const stepEl = document.getElementById(`step-${step}`);
        if (!stepEl) return;

        // Clone current formData to avoid losing existing data if form is partial
        const currentData = step === 1 ? { ...this.formData.child } :
            step === 2 ? { ...this.formData.family } :
                step === 4 ? { ...this.formData.vulnerability } : {};

        // Get standard inputs
        const inputs = stepEl.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    currentData[input.name] = input.checked ? 'true' : 'false';
                } else {
                    currentData[input.name] = input.value;
                }
            }
        });

        switch (step) {
            case 1:
                this.formData.child = currentData;
                break;
            case 2:
                this.formData.family = currentData;
                break;
            case 4:
                this.formData.vulnerability = currentData;
                break;
        }
    }

    saveRepresentatives() {
        const repsContainer = document.getElementById('representatives-list');
        if (!repsContainer) return;

        const repCards = repsContainer.querySelectorAll('.representative-card');
        this.formData.representatives = [];

        repCards.forEach(card => {
            const inputs = card.querySelectorAll('input, select');
            const repData = {};
            inputs.forEach(input => {
                if (input.name) {
                    if (input.type === 'checkbox') {
                        repData[input.name] = input.checked; // Boolean for API
                    } else {
                        repData[input.name] = input.value;
                    }
                }
            });
            this.formData.representatives.push(repData);
        });
    }

    async submitApplication() {
        if (!this.validateStep(this.currentStep)) return;

        this.saveStepData(this.currentStep);

        // Calculate vulnerability score
        const vulnScore = this.calculateVulnerabilityScore(this.formData.vulnerability);

        // Prepare final data
        const applicationData = {
            // Child data
            child_first_name: this.formData.child.child_first_name,
            child_last_name: this.formData.child.child_last_name,
            child_birth_date: this.formData.child.child_birth_date,
            child_gender: this.formData.child.child_gender,
            child_cedula: this.formData.child.child_cedula,

            // Family data
            family_address: this.formData.family.family_address,
            family_city: this.formData.family.family_city,
            family_province: this.formData.family.family_province,
            family_phone_primary: this.formData.family.family_phone_primary,
            family_phone_secondary: this.formData.family.family_phone_secondary,
            emergency_contact_name: this.formData.family.emergency_contact_name,
            emergency_contact_phone: this.formData.family.emergency_contact_phone,
            emergency_contact_relationship: this.formData.family.emergency_contact_relationship,

            // Representatives
            representatives: this.formData.representatives,

            // Vulnerability
            vulnerability: this.formData.vulnerability
        };

        try {
            const response = await API.post('/applications/create', applicationData);
            showNotification('Solicitud creada exitosamente', 'success');
            closeModal('new-application-modal');
            this.reset();
            loadApplications();
        } catch (error) {
            console.error('Error creating application:', error);
            showNotification(error.message || 'Error al crear solicitud', 'error');
        }
    }

    calculateVulnerabilityScore(vulnData) {
        let score = 0;

        // Vivienda (0-20 puntos)
        if (vulnData.housing_type === 'precaria') score += 15;
        else if (vulnData.housing_type === 'compartida') score += 10;

        if (vulnData.housing_ownership === 'alquilada') score += 5;
        else if (vulnData.housing_ownership === 'prestada') score += 8;

        if (!vulnData.has_basic_services) score += 10;

        // Economía (0-25 puntos)
        const income = parseFloat(vulnData.monthly_income) || 0;
        if (income < 200) score += 25;
        else if (income < 400) score += 20;
        else if (income < 600) score += 15;
        else if (income < 800) score += 10;

        const dependents = parseInt(vulnData.num_dependents) || 0;
        if (dependents > 5) score += 10;
        else if (dependents > 3) score += 5;

        // Factores de riesgo (0-35 puntos)
        if (vulnData.single_parent === 'true') score += 8;
        if (vulnData.teen_parent === 'true') score += 10;
        if (vulnData.disability_in_family === 'true') score += 7;
        if (vulnData.chronic_illness === 'true') score += 5;
        if (vulnData.domestic_violence === 'true') score += 15;
        if (vulnData.substance_abuse === 'true') score += 15;

        // Educación (0-10 puntos)
        if (vulnData.parent_education_level === 'ninguna') score += 10;
        else if (vulnData.parent_education_level === 'primaria') score += 7;
        else if (vulnData.parent_education_level === 'secundaria') score += 4;

        // Ubicación (0-10 puntos)
        if (vulnData.geographic_zone === 'rural') score += 5;
        const distance = parseFloat(vulnData.distance_to_center) || 0;
        if (distance > 10) score += 5;
        else if (distance > 5) score += 3;

        return Math.min(score, 100); // Cap at 100
    }

    addRepresentative() {
        const container = document.getElementById('representatives-list');
        if (!container) return;

        const repCount = container.children.length + 1;
        const repCard = document.createElement('div');
        repCard.className = 'glass-card representative-card mb-2';
        repCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4>Representante ${repCount}</h4>
                <button type="button" class="btn btn-danger btn-sm" onclick="applicationWizard.removeRepresentative(this)">
                    🗑️ Eliminar
                </button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Nombres *</label>
                    <input type="text" name="first_name" required>
                </div>
                <div class="form-group">
                    <label>Apellidos *</label>
                    <input type="text" name="last_name" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Cédula</label>
                    <input type="text" name="cedula" maxlength="10">
                </div>
                <div class="form-group">
                    <label>Parentesco *</label>
                    <select name="relationship" required>
                        <option value="">Seleccione...</option>
                        <option value="madre">Madre</option>
                        <option value="padre">Padre</option>
                        <option value="abuelo">Abuelo</option>
                        <option value="abuela">Abuela</option>
                        <option value="tio">Tío</option>
                        <option value="tia">Tía</option>
                        <option value="tutor_legal">Tutor Legal</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="tel" name="phone">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ocupación</label>
                    <input type="text" name="occupation">
                </div>
                <div class="form-group">
                    <label>Lugar de Trabajo</label>
                    <input type="text" name="workplace">
                </div>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" name="is_primary" value="true">
                    Representante Principal
                </label>
            </div>
        `;
        container.appendChild(repCard);
    }

    removeRepresentative(button) {
        const card = button.closest('.representative-card');
        if (card) card.remove();
    }

    reset() {
        this.currentStep = 1;
        this.formData = {
            child: {},
            family: {},
            representatives: [],
            vulnerability: {}
        };

        // Clear all forms
        const forms = document.querySelectorAll('#new-application-modal form');
        forms.forEach(form => form.reset());

        // Clear representatives
        const repsContainer = document.getElementById('representatives-list');
        if (repsContainer) repsContainer.innerHTML = '';

        this.showStep(1);
    }
}

// Global instance
let applicationWizard = new ApplicationFormWizard();
