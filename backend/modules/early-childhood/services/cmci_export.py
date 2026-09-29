"""
CMCI Export Service — F4 (Fase 4 del plan).
5 exports xlsx con openpyxl: encabezado distintivo por matriz (para no
confundir general/posibles/única/consolidada/asistencia) + fecha de corte
+ filtros aplicados. No toca ExportService existente: lo reutiliza para estilos base.
"""
import io
from datetime import date, datetime

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

# Encabezado distintivo por matriz (color + título oficial).
MATRIX_STYLE = {
    'matriz-general':    {'title': 'MATRIZ GENERAL DE USUARIOS', 'color': '1F4E79'},
    'matriz-posibles':   {'title': 'MATRIZ DE POSIBLES BENEFICIARIOS', 'color': '548235'},
    'matriz-unica':      {'title': 'MATRIZ ÚNICA DE BENEFICIARIOS', 'color': 'BF8F00'},
    'matriz-consolidada': {'title': 'MATRIZ CONSOLIDADA — COORDINACIÓN', 'color': '7030A0'},
    'asistencia':        {'title': 'MATRIZ DE ASISTENCIA DE USUARIOS', 'color': 'C00000'},
}

EXPORT_HEADERS = {
    'matriz-general': ['N.', 'Centro', 'Cédula ID', 'Apellidos', 'Nombres', 'Sexo',
                       'Fecha Nac.', 'Edad', 'Representante', 'Teléfono', 'Dirección',
                       'Estado', 'Puntaje Vulnerabilidad'],
    'matriz-posibles': ['N.', 'Fecha solicitud', 'Solicitante', 'Cédula', 'Teléfono',
                        'Niños a cargo', 'Ingreso aprox.', 'Estado solicitud', 'Observación'],
    'matriz-unica': ['N.', 'Código', 'Niño/a', 'Cédula', 'Edad (m)', 'Centro',
                     'Total Vuln.', 'Nivel', 'Prioridad', 'Estado'],
    'matriz-consolidada': ['Centro', 'Niños activos', 'Reg. asistencia', 'Tasa asistencia',
                           'Reg. salud', 'Eval. desarrollo', 'Informes mes'],
    'asistencia': None,  # matriz dinámica (niños x días)
}


def _styled_workbook(title, color, center_name, period_label, filters_label):
    wb = Workbook()
    ws = wb.active
    ws.title = 'Matriz'
    ws['A1'] = title
    ws['A1'].font = Font(bold=True, size=14, color='FFFFFF')
    ws['A1'].fill = PatternFill(start_color=color, end_color=color, fill_type='solid')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.merge_cells('A1:N1')
    ws.row_dimensions[1].height = 28
    ws['A2'] = f'Centro: {center_name}  |  Corte: {period_label}  |  Generado: {datetime.now().strftime("%Y-%m-%d %H:%M")}'
    ws['A2'].font = Font(size=10, italic=True)
    ws.merge_cells('A2:N2')
    ws['A3'] = f'Filtros aplicados: {filters_label}'
    ws['A3'].font = Font(size=10, italic=True)
    ws.merge_cells('A3:N3')
    return wb, ws


def build_matrix_workbook(matrix_key, rows, center_name='Centro',
                           period_label='', filters_label=''):
    """Construye xlsx estilizado para una de las 5 matrices. Retorna BytesIO."""
    if not EXCEL_AVAILABLE:
        raise ImportError('openpyxl requerido: pip install openpyxl')
    style = MATRIX_STYLE[matrix_key]
    headers = EXPORT_HEADERS[matrix_key]
    wb, ws = _styled_workbook(style['title'], style['color'], center_name,
                               period_label or date.today().isoformat(),
                               filters_label or 'ninguno')
    start_row = 5
    thin = Border(left=Side(style='thin'), right=Side(style='thin'),
                  top=Side(style='thin'), bottom=Side(style='thin'))
    hdr_fill = PatternFill(start_color=style['color'], end_color=style['color'], fill_type='solid')
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=col, value=h)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = hdr_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin
    for r_idx, row in enumerate(rows, start_row + 1):
        vals = list(row.values()) if isinstance(row, dict) else list(row)
        for c_idx, val in enumerate(vals, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = thin
            cell.alignment = Alignment(horizontal='center', vertical='center')
        if r_idx % 2 == 0:
            for c_idx in range(1, len(vals) + 1):
                ws.cell(row=r_idx, column=c_idx).fill = PatternFill(
                    start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')
    # Anchos (solo columnas de datos: evita MergedCell del encabezado)
    for c_idx in range(1, len(headers) + 1):
        max_len = 0
        for row in ws.iter_rows(min_col=c_idx, max_col=c_idx, min_row=1,
                                max_row=ws.max_row):
            for cell in row:
                try:
                    max_len = max(max_len, len(str(cell.value or '')))
                except Exception:
                    pass
        ws.column_dimensions[ws.cell(row=5, column=c_idx).column_letter].width = min(max_len + 2, 42)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def build_attendance_matrix_workbook(matrix_rows, day_headers, center_name='Centro',
                                     period_label='', filters_label=''):
    """Matriz de asistencia: filas niños, columnas días (P/F/J/A)."""
    if not EXCEL_AVAILABLE:
        raise ImportError('openpyxl requerido: pip install openpyxl')
    style = MATRIX_STYLE['asistencia']
    headers = ['N.', 'Cédula', 'Niño'] + list(day_headers)
    wb, ws = _styled_workbook(style['title'], style['color'], center_name,
                               period_label, filters_label or 'ninguno')
    start_row = 5
    thin = Border(left=Side(style='thin'), right=Side(style='thin'),
                  top=Side(style='thin'), bottom=Side(style='thin'))
    hdr_fill = PatternFill(start_color=style['color'], end_color=style['color'], fill_type='solid')
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=start_row, column=col, value=h)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = hdr_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = thin
    for r_idx, row in enumerate(matrix_rows, start_row + 1):
        vals = list(row.values()) if isinstance(row, dict) else list(row)
        for c_idx, val in enumerate(vals, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = thin
            cell.alignment = Alignment(horizontal='center')
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
