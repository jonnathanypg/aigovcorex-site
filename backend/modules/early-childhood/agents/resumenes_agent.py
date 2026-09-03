"""
Resumenes Agent - Generates summaries and reports on demand
"""
from typing import Dict
from agents.llm_interface import get_llm
from models.child import Child
from models.attendance import Attendance
from models.nutrition import NutritionDaily
from models.health import HealthRecord
from models.milestone import Milestone
from datetime import date, timedelta
from sqlalchemy import func


class ResumenesAgent:
    """
    Agent specialized in generating summaries and reports
    Example: "Dame un resumen del desarrollo de Sofía este mes"
    """
    
    def __init__(self, tenant_id: int, user_id: int):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.llm = get_llm()
    
    def process(self, message: str, context: Dict) -> Dict:
        """Process summary request"""
        try:
            # Parse request
            request_data = self._parse_request(message, context)
            
            # Find child if specified
            child = None
            if request_data.get('child_name'):
                child = self._find_child(request_data['child_name'])
                if not child:
                    return {
                        'response': f"No encontré al niño/niña '{request_data['child_name']}'.",
                        'success': False,
                        'agent_used': 'resumenes'
                    }
            
            # Generate summary based on type
            summary_type = request_data.get('type', 'general')
            
            if summary_type == 'desarrollo':
                summary = self._development_summary(child, request_data.get('period', 'month'))
            elif summary_type == 'asistencia':
                summary = self._attendance_summary(child, request_data.get('period', 'month'))
            elif summary_type == 'nutricion':
                summary = self._nutrition_summary(child, request_data.get('period', 'month'))
            elif summary_type == 'salud':
                summary = self._health_summary(child, request_data.get('period', 'month'))
            else:
                summary = self._general_summary(child, request_data.get('period', 'month'))
            
            return {
                'response': summary,
                'success': True,
                'agent_used': 'resumenes',
                'action': 'summary_generation'
            }
            
        except Exception as e:
            return {
                'response': f'Error al generar resumen: {str(e)}',
                'success': False,
                'error': str(e),
                'agent_used': 'resumenes'
            }
    
    def _parse_request(self, message: str, context: Dict) -> Dict:
        """Parse summary request"""
        system_prompt = """Analiza la solicitud de resumen.

Identifica:
- child_name: Nombre del niño (si se menciona)
- type: Tipo de resumen (desarrollo, asistencia, nutricion, salud, general)
- period: Período (week, month, year)

Responde con JSON:
{
    "child_name": "nombre o null",
    "type": "desarrollo",
    "period": "month"
}"""
        
        context_info = ""
        if context.get('last_child_name'):
            context_info = f"\nÚltimo niño mencionado: {context['last_child_name']}"
        
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'{message}{context_info}'}
        ]
        
        response = self.llm.chat_completion(messages, temperature=0.2, max_tokens=200)
        return self.llm.extract_json(response)
    
    def _find_child(self, child_name: str) -> Child:
        """Find child by name"""
        children = Child.query.filter_by(
            tenant_id=self.tenant_id,
            status='activo'
        ).all()
        
        child_name_lower = child_name.lower()
        
        for child in children:
            if (child_name_lower in child.first_name.lower() or
                child_name_lower in child.full_name.lower()):
                return child
        
        return None
    
    def _get_date_range(self, period: str):
        """Get date range for period"""
        today = date.today()
        
        if period == 'week':
            start_date = today - timedelta(days=7)
        elif period == 'month':
            start_date = today - timedelta(days=30)
        elif period == 'year':
            start_date = today - timedelta(days=365)
        else:
            start_date = today - timedelta(days=30)
        
        return start_date, today
    
    def _development_summary(self, child: Child, period: str) -> str:
        """Generate development summary"""
        start_date, end_date = self._get_date_range(period)
        
        milestones = Milestone.query.filter(
            Milestone.child_id == child.id,
            Milestone.record_date >= start_date,
            Milestone.record_date <= end_date
        ).all()
        
        if not milestones:
            return f"📊 No hay registros de desarrollo para {child.full_name} en este período."
        
        # Group by domain
        by_domain = {}
        for m in milestones:
            if m.domain not in by_domain:
                by_domain[m.domain] = []
            by_domain[m.domain].append(m)
        
        summary = f"📊 Resumen de Desarrollo - {child.full_name}\n"
        summary += f"Período: {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}\n\n"
        
        for domain, items in by_domain.items():
            domain_name = items[0].domain_display
            summary += f"🎯 {domain_name}:\n"
            for item in items:
                summary += f"  • {item.milestone_description} ({item.achievement_level})\n"
            summary += "\n"
        
        return summary
    
    def _attendance_summary(self, child: Child, period: str) -> str:
        """Generate attendance summary"""
        start_date, end_date = self._get_date_range(period)
        
        attendance = Attendance.query.filter(
            Attendance.child_id == child.id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ).all()
        
        if not attendance:
            return f"📅 No hay registros de asistencia para {child.full_name} en este período."
        
        # Count by status
        stats = {
            'presente': 0,
            'ausente': 0,
            'justificado': 0,
            'tardanza': 0
        }
        
        for a in attendance:
            stats[a.status] = stats.get(a.status, 0) + 1
        
        total = len(attendance)
        percentage = (stats['presente'] / total * 100) if total > 0 else 0
        
        summary = f"📅 Resumen de Asistencia - {child.full_name}\n"
        summary += f"Período: {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}\n\n"
        summary += f"✅ Presente: {stats['presente']} días\n"
        summary += f"❌ Ausente: {stats['ausente']} días\n"
        summary += f"📝 Justificado: {stats['justificado']} días\n"
        summary += f"⏰ Tardanza: {stats['tardanza']} días\n"
        summary += f"\n📊 Asistencia: {percentage:.1f}%"
        
        return summary
    
    def _nutrition_summary(self, child: Child, period: str) -> str:
        """Generate nutrition summary"""
        start_date, end_date = self._get_date_range(period)
        
        nutrition = NutritionDaily.query.filter(
            NutritionDaily.child_id == child.id,
            NutritionDaily.date >= start_date,
            NutritionDaily.date <= end_date
        ).all()
        
        if not nutrition:
            return f"🍽️ No hay registros de nutrición para {child.full_name} en este período."
        
        # Calculate average consumption
        total_consumption = sum(n.consumption_percentage for n in nutrition)
        avg_consumption = total_consumption / len(nutrition) if nutrition else 0
        
        summary = f"🍽️ Resumen de Nutrición - {child.full_name}\n"
        summary += f"Período: {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}\n\n"
        summary += f"📊 Consumo promedio: {avg_consumption:.1f}%\n"
        summary += f"📝 Registros: {len(nutrition)} comidas\n"
        
        return summary
    
    def _health_summary(self, child: Child, period: str) -> str:
        """Generate health summary"""
        start_date, end_date = self._get_date_range(period)
        
        health = HealthRecord.query.filter(
            HealthRecord.child_id == child.id,
            HealthRecord.record_date >= start_date,
            HealthRecord.record_date <= end_date
        ).all()
        
        if not health:
            return f"🏥 No hay registros de salud para {child.full_name} en este período."
        
        summary = f"🏥 Resumen de Salud - {child.full_name}\n"
        summary += f"Período: {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}\n\n"
        
        for h in health:
            summary += f"• {h.record_date.strftime('%d/%m')}: {h.record_type}\n"
            if h.symptoms:
                summary += f"  Síntomas: {h.symptoms}\n"
        
        return summary
    
    def _general_summary(self, child: Child, period: str) -> str:
        """Generate general summary"""
        summaries = []
        summaries.append(self._attendance_summary(child, period))
        summaries.append(self._nutrition_summary(child, period))
        summaries.append(self._development_summary(child, period))
        
        return "\n\n".join(summaries)
