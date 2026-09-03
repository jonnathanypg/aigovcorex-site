# **KindiCoreAI: Sistema Integral de Gestión y Monitoreo (TypeScript Edition)**

## **1\. Visión General**

KindiCoreAI es una plataforma **Multi-tenant** y **Multi-agente** diseñada para la gestión de centros infantiles (CDI/CMCI). Migramos a TypeScript para aprovechar el tipado fuerte y la escalabilidad de NestJS en entornos de alta concurrencia.

## **2\. Stack Tecnológico (The TS Core)**

* **Backend:** Node.js con **NestJS** (Arquitectura basada en módulos, controladores y servicios).  
* **Lenguaje:** TypeScript 5.x.  
* **IA Orchestration:** **LangGraph.js** y LangChain.js.  
* **Base de Datos:** PostgreSQL con **Prisma ORM** (manejo nativo de tipos y JSONB).  
* **Multi-tenancy:** Estrategia de aislamiento a nivel de esquema o discriminador de tenantId en Prisma.  
* **Frontend:** React con Next.js 14+ (App Router) y Tailwind CSS.  
* **Comunicación:** REST API y WebSockets para notificaciones en tiempo real.

## **3\. Arquitectura de Módulos (NestJS Modules)**

En lugar de Blueprints, usaremos **NestJS Modules**:

* **AuthModule:** Gestión de JWT, Roles y Multi-tenancy.  
* **RegistrationModule:** Fichas socioeconómicas y validación de vulnerabilidad.  
* **IdiiModule:** Seguimiento de hitos del desarrollo integral infantil.  
* **AgentModule:** Orquestación de LangGraph.js para el sistema multi-agente.

## **4\. Ecosistema Multi-Agente (LangGraph.js)**

El flujo de agentes se define mediante grafos de estado:

1. **Ingestion Node:** Procesa buffers de imagen/voz usando Gemini Multi-modal.  
2. **Validation Node:** Contrasta datos con la normativa MIES/DASE.  
3. **Persistence Node:** Escribe en PostgreSQL a través de servicios de NestJS.

## **5\. Perfiles y Seguridad (RBAC)**

* Uso de **Guards** de NestJS para proteger rutas según el rol (ADMIN, COORDINATOR, EDUCATOR).  
* **Interceptor de Tenancy:** Inyecta automáticamente el tenantId desde el token JWT en todas las consultas a la DB.

## **6\. Plan de Implementación**

* **Fase 1:** Setup de NestJS \+ Prisma \+ PostgreSQL (Esquemas Multi-tenant).  
* **Fase 2:** Implementación de servicios para Fichas IDII y Socioeconómica.  
* **Fase 3:** Integración de LangGraph.js para procesamiento de lenguaje natural.  
* **Fase 4:** Dashboard en Next.js con Server Components.