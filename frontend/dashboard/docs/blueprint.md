# **App Name**: KindiCoreAI

## Core Features:

- User Registration: Allow CMCI users to register and create profiles, capturing essential data such as ChildProfile, LegalGuardian, FamilyNucleus, SocioeconomicData, VulnerabilityCriteria, and Geolocation.
- Admission Workflow: Implement a state machine to manage the admission process, including scoring applicants based on socioeconomic data and generating digital acceptance letters. The state machine includes the following states: POSTULADO -> VALIDANDO -> APROBADO / LISTA_ESPERA / RECHAZADO.
- Document Management with OCR: Enable users to upload and manage digital documents, leveraging OCR technology to automatically validate identification documents and extract relevant data.
- Attendance Tracking: Provide an interface for educators to record daily attendance, track absences, and automatically cross-validate attendance against active enrollment to manage meal planning.
- Development Monitoring (IDII): Digitize the IDII checklist for tracking child development, providing early alerts for developmental delays, and enabling nutritional monitoring with weight/height charts.
- Intelligent Data Ingestion: Utilize Gemini Vision tool to extract handwritten text and signatures from uploaded photos of technical visit forms, automatically populating the database.
- AI-Powered Data Analysis: Implement LangChain SQL Tool to allow the system to answer complex analytical questions using the database and generate visualizations of results. The Analyst tool will allow non-technical CMCI staff to efficiently compare nutrition levels across centers and track language milestone attainment.

## Style Guidelines:

- Primary color: Sky Blue (#87CEEB), conveying trust and security appropriate for a child-focused system.
- Background color: Very light Blue (#F0F8FF), providing a calm and clean backdrop for detailed information.
- Accent color: Soft Lavender (#E6E6FA), highlighting interactive elements and calls to action with a gentle touch.
- Body and headline font: 'PT Sans' (sans-serif) for a modern and easily readable interface. Note: currently only Google Fonts are supported.
- Use simple and friendly icons throughout the interface to aid in navigation and enhance user understanding.
- Design the coordinator dashboard as a control tower, using real-time widgets and clear visualizations to present critical information at a glance.
- Incorporate subtle transitions and animations to provide feedback on user interactions, such as form submissions and data updates.