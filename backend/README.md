# ⚙️ Incatour - Backend API REST

Servicio API REST para el sistema **Incatour**, encargado de la lógica de negocio, autenticación, gestión de clientes, reservas y persistencia en PostgreSQL.

Pensado para ejecutarse en entorno **LOCAL** (`http://localhost:3000`).

---

## 🛠️ Tecnologías

* **Runtime:** Node.js
* **Framework Web:** Express 5 (`express`)
* **Lenguaje:** TypeScript (`typescript`, `tsx`)
* **Base de Datos:** PostgreSQL (`pg`)
* **Variables de Entorno:** `dotenv`, `env-var`
* **CORS:** `cors`

---

## 📂 Estructura de Directorios

```text
backend/
├── src/
│   ├── app.ts            # Punto de entrada de Express
│   ├── config/           # Conexión DB PostgreSQL y lectura de variables de entorno
│   ├── controllers/      # Controladores de solicitudes HTTP
│   ├── dtos/             # Data Transfer Objects (validación de payloads)
│   ├── error/            # Manejo centralizado de errores de la API
│   ├── middlewares/      # Middlewares (autenticación, CORS, validaciones)
│   ├── models/           # Modelos de datos y consultas SQL
│   ├── routes/           # Definición de rutas (/api/...)
│   └── services/         # Servicios de lógica de negocio
├── .env                  # Variables locales compartidas (incluido en Git)
├── tsconfig.json         # Configuración de TypeScript
└── package.json          # Dependencias y scripts
```

---

## ⚙️ Configuración de Entorno (`.env`)

El archivo `.env` ya viene incluido en el repositorio con las credenciales locales por defecto:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgrespassword
DB_NAME=incatour_db
JWT_SEED=incatour_secreto_desarrollo_local_123
```

---

## 🚀 Ejecución Local

### Opción A (Recomendada - Desde la raíz):
```bash
# Desde la carpeta principal 'Incatour/'
npm run dev
```

### Opción B (Independiente):
```bash
# Desde 'Incatour/backend/'
npm run dev
```

El servidor quedará escuchando en `http://localhost:3000`.

---

## 📡 Endpoints Base

| Método | Ruta | Descripción | Estado |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/` | Chequeo de estado de la API | 🟢 Activo |
| `POST` | `/api/clientes/registro` | Registro de clientes | 🟡 En desarrollo |

---

## 🔗 Enlaces Relacionados
* ⬅️ **[Volver al README Principal](../README.md)**
* 🎨 **[Frontend README](../frontend/README.md)**
