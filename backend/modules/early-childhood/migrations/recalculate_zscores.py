"""
Migration script to recalculate and populate WHO Z-scores for all existing HealthRecords
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from app import create_app
from models import db
from models.health import HealthRecord
from models.child import Child
from services.who_standards import WHOStandardsService
from dateutil.relativedelta import relativedelta

app = create_app()

with app.app_context():
    records = HealthRecord.query.filter_by(record_type='crecimiento').all()
    updated = 0
    print(f'Found {len(records)} growth records.')
    
    for r in records:
        child = Child.query.get(r.child_id)
        if not child or not child.birth_date or not r.record_date:
            continue
            
        delta = relativedelta(r.record_date, child.birth_date)
        age_months = max(0, delta.years * 12 + delta.months)
        gender = child.gender or 'M'
        
        needs_update = False
        
        if r.weight:
            z_w = WHOStandardsService.calculate_weight_zscore(float(r.weight), age_months, gender)
            if z_w is not None and r.z_score_weight != z_w:
                r.z_score_weight = z_w
                needs_update = True
                
        if r.height:
            z_h = WHOStandardsService.calculate_height_zscore(float(r.height), age_months, gender)
            if z_h is not None and r.z_score_height != z_h:
                r.z_score_height = z_h
                needs_update = True
                
        if needs_update:
            updated += 1
            
    db.session.commit()
    print(f'Successfully updated {updated} records with WHO Z-scores.')
