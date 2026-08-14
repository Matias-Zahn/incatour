# 🏔️ Incatour - Sistema de Gestión Turística

Plataforma integral para la gestión de reservas, paquetes comerciales y logística del **Camino del Inca**. 

Proyecto diseñado para desarrollo colaborativo en equipo (**5 integrantes**), ejecutándose al 100% en entorno **LOCAL** (Localhost + Docker).

---

## 🛠️ Tecnologías del Proyecto

| Capa | Tecnologías | Puerto Local |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS v4, React Router | `http://localhost:5173` |
| **Backend** | Node.js, Express 5, TypeScript, tsx, PostgreSQL (`pg`) | `http://localhost:3000` |
| **Base de Datos** | PostgreSQL 16 (vía Docker Compose) | `localhost:5432` |

---

## 📂 Estructura del Proyecto

```text
incatour/
├── docker-compose.yml   # Contenedor de la base de datos PostgreSQL
├── package.json         # Scripts raíz para arrancar todo el proyecto junto
├── README.md            # Documentación principal del equipo
├── backend/             # API REST (Express + TypeScript) -> Ver backend/README.md
│   └── .env             # Configuración local compartida lista para usar
└── frontend/            # Cliente Web (React + Vite) -> Ver frontend/README.md
```

---

## 📋 Requisitos Previos (Cada Integrante)

Cada uno de los 5 miembros debe tener instalado en su máquina local:
* [Node.js](https://nodejs.org/) (v18 o superior)
* [Docker Desktop](https://www.docker.com/) o Docker Engine + Docker Compose
* [Git](https://git-scm.com/)

---

## 🚀 Puesta en Marcha Rápida (Entorno Local)

Al estar el archivo `.env` precargado para el entorno local, la puesta en marcha toma solo 3 pasos:

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd Incatour

# Instalar dependencias del root, backend y frontend
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Levantar la Base de Datos con Docker
```bash
docker compose up -d
```
*(Nota en Linux: si requiere permisos de superusuario, usa `sudo docker compose up -d`).*

### 3. Arrancar el Proyecto (Backend + Frontend en paralelo)
Desde la carpeta raíz del proyecto (`incatour/`), ejecuta:
```bash
npm run dev
```

¡Listo! El comando iniciará automáticamente ambos servidores:
* 🌐 **Frontend:** `http://localhost:5173`
* ⚙️ **Backend API:** `http://localhost:3000`

---

## 🛑 Comandos Frecuentes de Desarrollo Local

| Acción | Comando |
| :--- | :--- |
| **Levantar todo (Backend + Frontend)** | `npm run dev` (en la raíz) |
| **Levantar solo Backend** | `npm run dev:backend` (en la raíz) |
| **Levantar solo Frontend** | `npm run dev:frontend` (en la raíz) |
| **Apagar la base de datos (Docker)** | `docker compose down` |
| **Reiniciar la DB borrando datos** | `docker compose down -v && docker compose up -d` |

---

## 👥 Flujo de Trabajo para el Equipo (5 Integrantes)

Para mantener la organización y evitar conflictos en el código entre los 5 miembros del equipo:

### 1. Manejo de Ramas en Git
* **`main`**: Rama principal estable. Solo contiene código probado en local.
* **Ramas de funcionalidad**: Cada integrante creará una rama según la tarea:
  - `feat/nombre-tarea` (ej: `feat/login-cliente`, `feat/tabla-reservas`)
  - `fix/nombre-bug` (ej: `fix/conexion-db`)
  - `docs/nombre-doc` (ej: `docs/actualizar-readme`)

### 2. Pasos Diarios Recomendados
1. Antes de empezar a trabajar, actualiza tu rama `main` local:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Crea tu rama de trabajo:
   ```bash
   git checkout -b feat/mi-nueva-funcionalidad
   ```
3. Realiza tus cambios y prueba que todo funcione en `http://localhost:5173`.
4. Sube tu rama a Git y abre un **Pull Request (PR)** para que al menos un compañero revise el código antes de fusionarlo a `main`.

---

## 📚 Documentación Interna
* ⚙️ **[Guía del Backend (`backend/README.md`)](./backend/README.md)**
* 🎨 **[Guía del Frontend (`frontend/README.md`)](./frontend/README.md)**
