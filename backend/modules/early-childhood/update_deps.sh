@echo off
REM Script de actualización de dependencias
echo "Actualizando dependencias críticas..."
pip install --upgrade -r requirements.txt
echo "Dependencias actualizadas. Por favor, reinicia la aplicación con 'python app.py'"
