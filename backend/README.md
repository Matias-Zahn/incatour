# ⚙️ Incatour - Backend API REST

Servicio API REST para el sistema **Incatour**, encargado de la lógica de negocio, autenticación, gestión de clientes, reservas y persistencia en PostgreSQL.

Pensado para ejecutarse en entorno **LOCAL** (`http://localhost:3000`).

---

## 🛠️ Tecnologías

* **Runtime:** Node.js
* **Framework Web:** Express 5 (`express`)
* **Lenguaje:** TypeScript (`typescript`, `tsx`)
* **Base de Datos & ORM:** PostgreSQL + Prisma ORM (v5)
* **Infraestructura Local:** Docker & Docker Compose
* **Variables de Entorno:** `dotenv`, `env-var`
* **CORS:** `cors`

---

## 📂 Estructura de Directorios

```text
backend/
├── prisma/               # Configuración de base de datos
│   ├── migrations/       # Historial de migraciones SQL (¡No modificar!)
│   ├── schema.prisma     # Definición de modelos y conexión
│   └── seed.ts           # Script para poblar la base de datos con datos de prueba
├── src/
│   ├── app.ts            # Punto de entrada de Express
│   ├── config/           # Conexión DB con Prisma (Singleton) y lectura de variables
│   ├── controllers/      # Controladores de solicitudes HTTP
│   ├── dtos/             # Data Transfer Objects (validación de payloads)
│   ├── error/            # Manejo centralizado de errores de la API
│   ├── middlewares/      # Middlewares (autenticación, CORS, validaciones)
│   ├── routes/           # Definición de rutas (/api/...)
│   └── services/         # Servicios de lógica de negocio
├── .env                  # Variables locales compartidas (incluido en Git)
├── docker-compose.yml    # Configuración del contenedor de PostgreSQL
├── tsconfig.json         # Configuración de TypeScript
└── package.json          # Dependencias y scripts
```

---

## ⚙️ Configuración de Entorno (`.env`)

El archivo `.env` ya viene incluido en el repositorio con las credenciales locales por defecto. Asegúrate de contar con la variable `DATABASE_URL` requerida por Prisma:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgrespassword
DB_NAME=incatour_db
JWT_SEED=incatour_secreto_desarrollo_local_123

# URL de conexión para Prisma ORM
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/incatour_db?schema=public"
```

---

## 🚀 Ejecución Local (Paso a Paso)

Para levantar el entorno por primera vez o al descargar nuevos cambios del repositorio, sigue este orden exacto:

**1. Instalar dependencias:**
```bash
npm install
```

**2. Levantar el contenedor de la Base de Datos:**
```bash
docker compose up -d
```

**3. Sincronizar el esquema y aplicar reglas de seguridad (Check Constraints):**
```bash
npx prisma migrate dev
```

**4. Poblar la base de datos con datos de prueba (Seed):**
```bash
npm run db:seed
```

**5. Iniciar el servidor de desarrollo:**
```bash
npm run dev
```

El servidor quedará escuchando en `http://localhost:3000` y la base de datos estará lista para recibir peticiones.

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
