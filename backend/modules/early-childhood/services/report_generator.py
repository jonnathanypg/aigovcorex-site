"""
Report Generator Service
Centralizes data aggregation for different report types
"""
from datetime import date, datetime
from typing import Union, List
from sqlalchemy import func, and_
from models import db
from models.attendance import Attendance
from models.health import HealthRecord
from models.milestone import Milestone
from models.child import Child, Family, Representative
from models.tenant import Tenant
from services.who_standards import WHOStandardsService


class ReportGenerator:
    """Service for generating report data from different modules"""
    
    @staticmethod
    def _normalize_tenant_ids(tenant_id: Union[int, List[int]]) -> List[int]:
        """Convert single tenant_id or list to a consistent list"""
        if isinstance(tenant_id, list):
            return tenant_id
        return [tenant_id]
    
    @staticmethod
    def _is_global(tenant_id: Union[int, List[int]]) -> bool:
        """Check if this is a global (multi-center) report"""
        return isinstance(tenant_id, list) and len(tenant_id) > 1
    
    @staticmethod
    def _get_tenant_name_map(tenant_ids: List[int]) -> dict:
        """Build a map of tenant_id -> tenant_name for global reports"""
        tenants = Tenant.query.filter(Tenant.id.in_(tenant_ids)).all()
        return {t.id: t.name for t in tenants}

    @staticmethod
    def generate_attendance_report(tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Generate attendance report data
        Returns: { headers, rows, summary }
        """
        tenant_ids = ReportGenerator._normalize_tenant_ids(tenant_id)
        is_global = ReportGenerator._is_global(tenant_id)
        
        # Build query
        query = db.session.query(
            Attendance.date,
            Child.first_name,
            Child.last_name,
            Attendance.status,
            Attendance.arrival_time,
            Attendance.departure_time,
            Attendance.notes,
            Attendance.tenant_id,
            Child.cedula
        ).join(Child, Attendance.child_id == Child.id).filter(
            Attendance.tenant_id.in_(tenant_ids),
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).order_by(Attendance.date.desc(), Child.first_name).all()
        
        # Build tenant name map for global reports
        tenant_map = ReportGenerator._get_tenant_name_map(tenant_ids) if is_global else {}
        
        # Format rows
        rows = []
        for idx, record in enumerate(query, 1):
            full_name = f"{record.last_name}, {record.first_name}"
            row = {'n.': idx}
            if is_global:
                row['centro'] = tenant_map.get(record.tenant_id, 'N/A')
            row.update({
                'cédula': record.cedula if record.cedula else 'S/N',
                'fecha': record.date.isoformat() if record.date else '',
                'niño': full_name,
                'estado': record.status or '',
                'hora_entrada': str(record.arrival_time) if record.arrival_time else '-',
                'hora_salida': str(record.departure_time) if record.departure_time else '-',
                'observaciones': record.notes or ''
            })
            rows.append(row)
        
        # Calculate summary
        total_records = len(rows)
        presentes = sum(1 for r in query if r.status == 'presente')
        ausentes = sum(1 for r in query if r.status == 'ausente')
        
        # Build headers
        headers = []
        if is_global:
            headers.append('Centro')
        headers.extend(['N.', 'Cédula', 'Fecha', 'Niño', 'Estado', 'Hora Entrada', 'Hora Salida', 'Observaciones'])
        
        return {
            'title': 'Reporte de Asistencia',
            'period': f"{start_date.isoformat()} al {end_date.isoformat()}",
            'headers': headers,
            'rows': rows,
            'summary': {
                'total_registros': total_records,
                'presentes': presentes,
                'ausentes': ausentes,
                'tasa_asistencia': round((presentes / total_records * 100), 1) if total_records > 0 else 0
            }
        }
    
    @staticmethod
    def generate_health_report(tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Generate health/nutrition report data
        Returns: { headers, rows, summary }
        """
        tenant_ids = ReportGenerator._normalize_tenant_ids(tenant_id)
        is_global = ReportGenerator._is_global(tenant_id)
        
        # Get growth records joined with Child and Tenant for consistent grouping and sorting
        query = db.session.query(
            HealthRecord.record_date,
            Child.first_name,
            Child.last_name,
            Child.gender,
            HealthRecord.record_type,
            HealthRecord.weight,
            HealthRecord.height,
            HealthRecord.head_circumference,
            HealthRecord.z_score_weight,
            HealthRecord.z_score_height,
            HealthRecord.notes,
            HealthRecord.tenant_id,
            Tenant.name.label('tenant_name'),
            Child.cedula,
            Child.birth_date
        ).join(Child, HealthRecord.child_id == Child.id
        ).join(Tenant, HealthRecord.tenant_id == Tenant.id
        ).filter(
            HealthRecord.tenant_id.in_(tenant_ids),
            HealthRecord.record_date >= start_date,
            HealthRecord.record_date <= end_date
        )
        
        # If multi-center, sort cleanly by Center name first, then Child last_name, then record_date
        if is_global:
            query = query.order_by(Tenant.name.asc(), Child.last_name.asc(), Child.first_name.asc(), HealthRecord.record_date.desc())
        else:
            query = query.order_by(Child.last_name.asc(), Child.first_name.asc(), HealthRecord.record_date.desc())
            
        records = query.all()
        
        tenant_map = ReportGenerator._get_tenant_name_map(tenant_ids) if is_global else {}
        
        rows = []
        nutritional_counts = {'Adecuado / Eutrófico': 0, 'Desnutrición': 0, 'Sobrepeso / Obesidad': 0}
        
        for idx, record in enumerate(records, 1):
            # Calculate BMI if weight and height available
            bmi = None
            if record.weight and record.height and record.height > 0:
                height_m = float(record.height) / 100
                bmi = round(float(record.weight) / (height_m * height_m), 2)
            
            full_name = f"{record.last_name}, {record.first_name}"
            row = {'n.': idx}
            if is_global:
                row['centro'] = record.tenant_name or tenant_map.get(record.tenant_id, 'N/A')
                
            child_age = ''
            age_months = None
            if record.birth_date and record.record_date:
                from dateutil.relativedelta import relativedelta
                rd = relativedelta(record.record_date, record.birth_date)
                years = rd.years
                months = rd.months
                age_months = max(0, years * 12 + months)
                if years > 0:
                    child_age = f"{years}a {months}m"
                else:
                    child_age = f"{months} m"

            w_val = float(record.weight) if record.weight else None
            h_val = float(record.height) if record.height else None
            z_w = float(record.z_score_weight) if record.z_score_weight is not None else None
            z_h = float(record.z_score_height) if record.z_score_height is not None else None

            # Calculate on the fly if missing
            if age_months is not None:
                if z_w is None and w_val:
                    z_w = WHOStandardsService.calculate_weight_zscore(w_val, age_months, record.gender or 'M')
                if z_h is None and h_val:
                    z_h = WHOStandardsService.calculate_height_zscore(h_val, age_months, record.gender or 'M')

            diag_nutricional = WHOStandardsService.classify_weight_status(z_w)
            if z_w is not None:
                if z_w < -2.0:
                    nutritional_counts['Desnutrición'] += 1
                elif z_w <= 2.0:
                    nutritional_counts['Adecuado / Eutrófico'] += 1
                else:
                    nutritional_counts['Sobrepeso / Obesidad'] += 1

            row.update({
                'cédula': record.cedula if record.cedula else 'S/N',
                'fecha': record.record_date.isoformat() if record.record_date else '',
                'niño': full_name,
                'edad': child_age,
                'peso_kg': w_val,
                'talla_cm': h_val,
                'z_peso': z_w,
                'z_talla': z_h,
                'diagnóstico': diag_nutricional,
                'notas': record.notes or ''
            })
            rows.append(row)
        
        # Calculate averages
        weights = [r['peso_kg'] for r in rows if r['peso_kg']]
        heights = [r['talla_cm'] for r in rows if r['talla_cm']]
        
        headers = []
        if is_global:
            headers.append('Centro')
        headers.extend(['N.', 'Cédula', 'Fecha', 'Niño', 'Edad', 'Peso (kg)', 'Talla (cm)', 'Z-Peso', 'Z-Talla', 'Diagnóstico', 'Notas'])
        
        return {
            'title': 'Reporte de Salud y Nutrición',
            'period': f"{start_date.isoformat()} al {end_date.isoformat()}",
            'headers': headers,
            'rows': rows,
            'summary': {
                'total_registros': len(rows),
                'peso_promedio': round(sum(weights) / len(weights), 2) if weights else 0,
                'talla_promedio': round(sum(heights) / len(heights), 2) if heights else 0,
                'estado_nutricional': nutritional_counts
            }
        }
    
    @staticmethod
    def generate_development_report(tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Generate child development report data (milestones)
        Returns: { headers, rows, summary }
        """
        tenant_ids = ReportGenerator._normalize_tenant_ids(tenant_id)
        is_global = ReportGenerator._is_global(tenant_id)
        
        records = db.session.query(
            Milestone.record_date,
            Child.first_name,
            Child.last_name,
            Milestone.domain,
            Milestone.milestone_description,
            Milestone.achievement_level,
            Milestone.notes,
            Milestone.tenant_id
        ).join(Child, Milestone.child_id == Child.id).filter(
            Milestone.tenant_id.in_(tenant_ids),
            Milestone.record_date >= start_date,
            Milestone.record_date <= end_date
        ).order_by(Milestone.record_date.desc(), Child.first_name).all()
        
        tenant_map = ReportGenerator._get_tenant_name_map(tenant_ids) if is_global else {}
        
        rows = []
        for record in records:
            full_name = f"{record.last_name}, {record.first_name}"
            row = {}
            if is_global:
                row['centro'] = tenant_map.get(record.tenant_id, 'N/A')
            row.update({
                'fecha': record.record_date.isoformat() if record.record_date else '',
                'niño': full_name,
                'area': record.domain or '',
                'indicador': record.milestone_description or '',
                'nivel': record.achievement_level or '',
                'observaciones': record.notes or ''
            })
            rows.append(row)
        
        # Count by achievement level
        levels = {}
        for r in rows:
            level = r['nivel']
            levels[level] = levels.get(level, 0) + 1
        
        headers = []
        if is_global:
            headers.append('Centro')
        headers.extend(['Fecha', 'Niño', 'Área', 'Indicador', 'Nivel', 'Observaciones'])
        
        return {
            'title': 'Reporte de Desarrollo Infantil',
            'period': f"{start_date.isoformat()} al {end_date.isoformat()}",
            'headers': headers,
            'rows': rows,
            'summary': {
                'total_evaluaciones': len(rows),
                'por_nivel': levels
            }
        }
    
    @staticmethod
    def generate_general_report(tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Generate general center report (combined KPIs)
        Returns: { headers, rows, summary }
        """
        tenant_ids = ReportGenerator._normalize_tenant_ids(tenant_id)
        is_global = ReportGenerator._is_global(tenant_id)
        
        if is_global:
            # Global: Generate per-center summary rows
            tenant_map = ReportGenerator._get_tenant_name_map(tenant_ids)
            rows = []
            total_children = 0
            total_attendance = 0
            total_present = 0
            total_health = 0
            total_milestones = 0
            
            for tid in tenant_ids:
                t_name = tenant_map.get(tid, 'N/A')
                
                active_children = Child.query.filter(
                    Child.tenant_id == tid,
                    Child.status == 'activo'
                ).count()
                
                att_total = Attendance.query.filter(
                    Attendance.tenant_id == tid,
                    Attendance.date >= start_date,
                    Attendance.date <= end_date
                ).count()
                
                att_present = Attendance.query.filter(
                    Attendance.tenant_id == tid,
                    Attendance.date >= start_date,
                    Attendance.date <= end_date,
                    Attendance.status == 'presente'
                ).count()
                
                health_count = HealthRecord.query.filter(
                    HealthRecord.tenant_id == tid,
                    HealthRecord.record_date >= start_date,
                    HealthRecord.record_date <= end_date
                ).count()
                
                milestone_count = Milestone.query.filter(
                    Milestone.tenant_id == tid,
                    Milestone.record_date >= start_date,
                    Milestone.record_date <= end_date
                ).count()
                
                rate = round((att_present / att_total * 100), 1) if att_total > 0 else 0
                
                rows.append({
                    'centro': t_name,
                    'niños_activos': active_children,
                    'reg_asistencia': att_total,
                    'tasa_asistencia': f"{rate}%",
                    'reg_salud': health_count,
                    'eval_desarrollo': milestone_count
                })
                
                total_children += active_children
                total_attendance += att_total
                total_present += att_present
                total_health += health_count
                total_milestones += milestone_count
            
            overall_rate = round((total_present / total_attendance * 100), 1) if total_attendance > 0 else 0
            
            return {
                'title': 'Reporte General Consolidado',
                'period': f"{start_date.isoformat()} al {end_date.isoformat()}",
                'headers': ['Centro', 'Niños Activos', 'Reg. Asistencia', 'Tasa Asistencia', 'Reg. Salud', 'Eval. Desarrollo'],
                'rows': rows,
                'summary': {
                    'total_centros': len(tenant_ids),
                    'niños_activos': total_children,
                    'tasa_asistencia_global': f"{overall_rate}%"
                }
            }
        else:
            # Single center (original logic)
            tid = tenant_ids[0]
            tenant = Tenant.query.get(tid)
            
            attendance_total = Attendance.query.filter(
                Attendance.tenant_id == tid,
                Attendance.date >= start_date,
                Attendance.date <= end_date
            ).count()
            
            attendance_present = Attendance.query.filter(
                Attendance.tenant_id == tid,
                Attendance.date >= start_date,
                Attendance.date <= end_date,
                Attendance.status == 'presente'
            ).count()
            
            health_count = HealthRecord.query.filter(
                HealthRecord.tenant_id == tid,
                HealthRecord.record_date >= start_date,
                HealthRecord.record_date <= end_date
            ).count()
            
            milestone_count = Milestone.query.filter(
                Milestone.tenant_id == tid,
                Milestone.record_date >= start_date,
                Milestone.record_date <= end_date
            ).count()
            
            active_children = Child.query.filter(
                Child.tenant_id == tid,
                Child.status == 'activo'
            ).count()
            
            rows = [
                {'metrica': 'Centro', 'valor': tenant.name if tenant else 'N/A'},
                {'metrica': 'Período', 'valor': f"{start_date.isoformat()} al {end_date.isoformat()}"},
                {'metrica': 'Niños Activos', 'valor': active_children},
                {'metrica': 'Registros de Asistencia', 'valor': attendance_total},
                {'metrica': 'Tasa de Asistencia', 'valor': f"{round((attendance_present / attendance_total * 100), 1) if attendance_total > 0 else 0}%"},
                {'metrica': 'Registros de Salud', 'valor': health_count},
                {'metrica': 'Evaluaciones de Desarrollo', 'valor': milestone_count},
            ]
            
            return {
                'title': 'Reporte General del Centro',
                'period': f"{start_date.isoformat()} al {end_date.isoformat()}",
                'headers': ['Métrica', 'Valor'],
                'rows': rows,
                'summary': {
                    'niños_activos': active_children,
                    'tasa_asistencia': round((attendance_present / attendance_total * 100), 1) if attendance_total > 0 else 0
                }
            }
    
    @staticmethod
    def generate_attendance_matrix_report(tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Generate a matrix-style attendance report (children as rows, days as columns).
        """
        from datetime import timedelta
        
        tenant_ids = ReportGenerator._normalize_tenant_ids(tenant_id)
        is_global = ReportGenerator._is_global(tenant_id)
        
        delta = end_date - start_date
        date_list = [start_date + timedelta(days=i) for i in range(delta.days + 1)]
        
        query = db.session.query(
            Attendance.date,
            Child.id.label('child_id'),
            Child.first_name,
            Child.last_name,
            Child.cedula,
            Attendance.status,
            Attendance.tenant_id
        ).join(Child, Attendance.child_id == Child.id).filter(
            Attendance.tenant_id.in_(tenant_ids),
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).all()
        
        children_query = db.session.query(
            Child.id, Child.first_name, Child.last_name, Child.tenant_id
        ).filter(
            Child.tenant_id.in_(tenant_ids),
            Child.status == 'activo'
        ).all()
        
        tenant_map = ReportGenerator._get_tenant_name_map(tenant_ids) if is_global else {}
        status_map = {'presente': 'P', 'ausente': 'F', 'justificado': 'J', 'atraso': 'A'}
        
        matrix = {}
        for c in children_query:
            row = {}
            if is_global:
                row['Centro'] = tenant_map.get(c.tenant_id, 'N/A')
            row['Niño'] = f"{c.last_name}, {c.first_name}"
            for d in date_list:
                row[d.strftime('%d/%m')] = ''
            matrix[c.id] = row
            
        for record in query:
            if record.child_id not in matrix:
                row = {}
                if is_global:
                    row['Centro'] = tenant_map.get(record.tenant_id, 'N/A')
                row['Cédula'] = record.cedula if record.cedula else 'S/N'
                row['Niño'] = f"{record.last_name}, {record.first_name}"
                for d in date_list:
                    row[d.strftime('%d/%m')] = ''
                matrix[record.child_id] = row
                
            header_key = record.date.strftime('%d/%m')
            val = status_map.get(record.status, str(record.status)[:1].upper() if record.status else '')
            matrix[record.child_id][header_key] = val
            
        rows = list(matrix.values())
        rows.sort(key=lambda x: x['Niño'])
        
        headers = []
        if is_global:
            headers.append('Centro')
        headers.append('N.')
        headers.append('Cédula')
        headers.append('Niño')
        for d in date_list:
            headers.append(d.strftime('%d/%m'))
            
        return {
            'title': 'Registro de Asistencia Mensual (Matriz)',
            'period': f"{start_date.isoformat()} al {end_date.isoformat()}",
            'headers': headers,
            'rows': rows,
            'summary': {
                'total_niños': len(rows),
                'dias_evaluados': len(date_list),
                'leyenda': 'P: Presente, F: Ausente, J: Justificado, A: Atraso'
            }
        }

    @staticmethod
    def generate_children_matrix_report(tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Generate a comprehensive matrix of children data, including 
        socioeconomic and vulnerability information.
        """
        tenant_ids = ReportGenerator._normalize_tenant_ids(tenant_id)
        is_global = ReportGenerator._is_global(tenant_id)
        
        # Query children with relationships
        query = db.session.query(Child, Family, Tenant).join(
            Family, Child.family_id == Family.id
        ).join(
            Tenant, Child.tenant_id == Tenant.id
        ).filter(
            Child.tenant_id.in_(tenant_ids),
            Child.status == 'activo'
        ).order_by(Tenant.name, Child.last_name, Child.first_name).all()
        
        rows = []
        for idx, (child, family, tenant) in enumerate(query, 1):
            # Get primary representative
            rep = Representative.query.filter_by(family_id=family.id, is_primary=True).first()
            if not rep:
                # Fallback to any representative if no primary marked
                rep = Representative.query.filter_by(family_id=family.id).first()
            
            row = {
                'n.': idx,
                'centro': tenant.name,
                'cédula_id': child.cedula or 'S/C',
                'apellidos': child.last_name,
                'nombres': child.first_name,
                'sexo': child.gender.capitalize() if child.gender else '',
                'fecha_de_nacimiento': child.birth_date.isoformat() if child.birth_date else '',
                'edad': child.age_display,
                'parentesco': rep.relationship.capitalize() if rep and rep.relationship else '',
                'representante': rep.full_name if rep else 'N/A',
                'cédula_rep': rep.cedula if rep else '',
                'teléfono_rep': rep.phone if rep else (family.phone_primary or ''),
                'dirección': family.address or '',
                'hogar': family.household_type or '',
                'vínculo_laboral': family.employment_type or '',
                'ingresos': family.monthly_income_range or '',
                'vivienda': family.housing_type or '',
                'zona': family.geographic_zone or '',
                'etnia': family.ethnic_identity or '',
                'discapacidad': 'SÍ' if family.has_disability else 'NO',
                'detalle_discapacidad': family.disability_detail or '',
                'movilidad': family.mobility_status or '',
                'riesgos': ", ".join(family.social_risks) if family.social_risks and isinstance(family.social_risks, list) else '',
                'condición_económica': family.economic_condition or '',
                'puntaje_vulnerabilidad': family.vulnerability_score or 0
            }
            rows.append(row)
            
        headers = [
            'N.', 'Centro', 'Cédula ID', 'Apellidos', 'Nombres', 'Sexo', 'Fecha de Nacimiento', 'Edad',
            'Representante', 'Parentesco', 'Cédula Rep', 'Teléfono Rep', 'Dirección',
            'Hogar', 'Vínculo Laboral', 'Ingresos', 'Vivienda', 'Zona', 'Etnia', 
            'Discapacidad', 'Detalle Discapacidad', 'Movilidad', 'Riesgos', 'Condición Económica', 'Puntaje'
        ]
        
        return {
            'title': 'Matriz Global de Niños y Familias',
            'period': f"Al {date.today().isoformat()}",
            'headers': headers,
            'rows': rows,
            'summary': {
                'total_registros': len(rows),
                'centros_incluidos': len(set(tenant_ids))
            }
        }

    @classmethod
    def generate(cls, report_type: str, tenant_id: Union[int, List[int]], start_date: date, end_date: date) -> dict:
        """
        Factory method to generate report based on type
        """
        generators = {
            'asistencia': cls.generate_attendance_report,
            'asistencia_matriz': cls.generate_attendance_matrix_report,
            'ninos_matriz': cls.generate_children_matrix_report,
            'salud': cls.generate_health_report,
            'desarrollo': cls.generate_development_report,
            'general': cls.generate_general_report
        }
        
        generator = generators.get(report_type.lower())
        if not generator:
            raise ValueError(f"Tipo de reporte no soportado: {report_type}")
        
        return generator(tenant_id, start_date, end_date)
