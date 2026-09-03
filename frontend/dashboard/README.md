# KindiCore AI - Frontend

Este es el frontend de la aplicación KindiCore AI, construido con Next.js 14 y TypeScript.

## 🚀 Stack Tecnológico

*   **Framework:** Next.js 14 (App Router)
*   **Lenguaje:** TypeScript (Estricto)
*   **UI:**
    *   TailwindCSS
    *   Shadcn/UI
    *   Radix UI
    *   Lucide Icons
*   **Gráficos:** Recharts
*   **Formularios:** React Hook Form + Zod
*   **Notificaciones:** Sonner

## ✨ Características

*   **Dashboard Interactivo:** Visualización de KPIs y métricas en tiempo real.
*   **Gestión de Admisiones:** Flujo completo de postulación, aprobación y matrícula.
*   **Operaciones del Centro:** Gestión de tareas de mantenimiento e intervenciones familiares.
*   **Carga Masiva de Datos:** Interfaz para importación/exportación de datos vía CSV (Usuarios, Niños, Asistencia, etc.).
*   **Salud y Nutrición:** Seguimiento diario y planificación de Menú Semanal para centros.
*   **Base de Conocimiento (RAG):** Interfaz para cargar y administrar documentos para la base de conocimiento de la IA.
*   **Notificaciones:** Sistema de notificaciones para administradores y coordinadores.
*   **Diseño Responsivo:** Adaptado para funcionar en dispositivos móviles y de escritorio.

## 🏁 Getting Started

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```
2.  **Ejecutar el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
3.  Abrir [http://localhost:9002](http://localhost:9002) en el navegador.

## 🏗️ Estructura del Proyecto

*   `src/app`: Contiene las páginas de la aplicación.
*   `src/components`: Contiene los componentes de la interfaz de usuario.
*   `src/services`: Contiene los servicios para interactuar con la API del backend.
*   `src/hooks`: Contiene los hooks personalizados de React.
