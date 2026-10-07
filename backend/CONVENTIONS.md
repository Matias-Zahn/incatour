# 📐 Convenciones del Backend — Guía para desarrollo con IA

## Para qué es este archivo

Este documento define las reglas de arquitectura y organización del backend de IncaTour.
**Si usás una IA para generar código, pegale este archivo como contexto** para que respete
la estructura del proyecto. Sin esto, la IA va a inventar su propia organización.

---

## Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Lenguaje:** TypeScript (ejecutado con `tsx`)
- **ORM:** Prisma (el cliente se importa desde `src/config/postgresDatabase.ts` como `db`)
- **Base de datos:** PostgreSQL 16 (contenedor Docker)

---

## Arquitectura por capas

Cada solicitud HTTP atraviesa estas 4 capas, siempre en este orden:

```
Route → Controller → Service → Repository → Prisma (db)
```

| Capa | Responsabilidad | Qué SÍ hace | Qué NO hace |
| :--- | :--- | :--- | :--- |
| **Route** | Definir endpoints HTTP | Mapear verbo+ruta a un método del controller | Lógica, validación, acceso a DB |
| **Controller** | Manejar HTTP | Leer `req.body`/`req.params`, validar campos del DTO, llamar al service, responder con `res.json()`, propagar errores con `next(error)` | Lógica de negocio, acceso a DB |
| **Service** | Lógica de negocio | Validar reglas (ej: "no dar de baja si tiene paquetes activos"), orquestar repositorios, tirar `CustomError` | Conocer Express (`req`, `res`), importar Prisma |
| **Repository** | Acceso a datos | Importar `db`, hacer queries con Prisma, devolver resultados | Lógica de negocio, conocer Express |

### Regla fundamental
> **Los servicios NO conocen Prisma.** Solo los repositorios importan `db`.

---

## Organización por módulos

El código se organiza por módulo (familia de tablas), **NO por capa**.

### ✅ Correcto — por módulo
```text
src/modulos/
  └── catalogo/
      ├── circuito.dto.ts
      ├── circuito.routes.ts
      ├── circuito.controller.ts
      ├── circuito.service.ts
      └── circuito.repository.ts
```

### ❌ Incorrecto — por capa
```text
src/
  ├── controllers/
  │   └── circuito.controller.ts
  ├── services/
  │   └── circuito.service.ts
  ├── repositories/
  │   └── circuito.repository.ts
  └── dtos/
      └── circuito.dto.ts
```

### Módulos del proyecto
```text
src/
├── shared/           # db, transacciones, errores, auth, validación (cosas comunes)
├── integraciones/    # autoridad, pasarela, notificador
└── modulos/
    ├── catalogo/     # circuitos, temporadas, paquetes, etapas
    ├── proveedores/  # proveedores, servicios
    ├── cuentas/      # usuarios, clientes, personal
    ├── reservas/     # reservas, solicitudes, transacciones, reembolsos
    ├── salidas/      # salidas, asignaciones, permisos
    └── campo/        # avances, incidentes
```

### Cada módulo contiene 5 archivos por entidad:
```
<entidad>.dto.ts          → Interfaces de entrada (CrearXxxDto, ModificarXxxDto)
<entidad>.routes.ts       → Clase con getter estático `getRoutes` que devuelve un Router
<entidad>.controller.ts   → Clase con métodos arrow async que reciben (req, res, next)
<entidad>.service.ts      → Clase con métodos async que reciben DTOs y devuelven datos
<entidad>.repository.ts   → Clase con métodos async que hablan con Prisma (db)
```

---

## Patrones de código obligatorios

### DTO (Data Transfer Object)
```typescript
// Clases con constructor privado y método estático `create` para validación
export class CrearCircuitoDto {
  private constructor(
    public nombreCircuito: string,
    public duracionDias: number,
    // campos opcionales con ?
    public parametrosPorteadores?: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearCircuitoDto?] {
    const { nombreCircuito, duracionDias, parametrosPorteadores } = obj;

    // Validación
    if (!nombreCircuito) return ["nombreCircuito es requerido"];
    if (duracionDias == null) return ["duracionDias es requerido"];

    return [undefined, new CrearCircuitoDto(nombreCircuito, duracionDias, parametrosPorteadores)];
  }
}
```

### Repository
```typescript
import { db } from "../../config/postgresDatabase";
import { CrearCircuitoDto } from "./circuito.dto";

export class CircuitoRepository {
  async findAll() {
    return db.circuito.findMany({ where: { estado: "ACTIVO" } });
  }

  async create(data: CrearCircuitoDto) {
    return db.circuito.create({ data: { ...data, estado: "ACTIVO" } });
  }
  // ...
}
```

### Service
```typescript
import { CustomError } from "../../error/CustomError";
import { CircuitoRepository } from "./circuito.repository";

export class CircuitoService {
  private repository = new CircuitoRepository();

  async crearCircuito(dto: CrearCircuitoDto) {
    const existe = await this.repository.existeNombre(dto.nombreCircuito);
    if (existe) {
      throw CustomError.badRequest("Ya existe un circuito con ese nombre.");
    }
    return this.repository.create(dto);
  }
}
```

### Controller
```typescript
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../../error/CustomError";
import { CrearCircuitoDto } from "./circuito.dto";
import { CircuitoService } from "./circuito.service";

const service = new CircuitoService();

export class CircuitoController {
  // SIEMPRE arrow functions para mantener el `this`
  // SIEMPRE propagar errores con next(error), NO hacer try/catch con res.status()
  crearCircuito = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Validar y crear DTO
      const [error, dto] = CrearCircuitoDto.create(req.body);
      if (error) throw CustomError.badRequest(error);

      // 2. Llamar al servicio
      const resultado = await service.crearCircuito(dto!);
      
      // 3. Responder
      return res.status(201).json({ mensaje: "Creado", data: resultado });
    } catch (error) {
      next(error); // ← el middleware global lo maneja
    }
  };
}
```

### Routes
```typescript
import { Router } from "express";
import { CircuitoController } from "./circuito.controller";

export class CircuitoRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new CircuitoController();

    router.get("/", controller.consultarCircuitos);
    router.post("/", controller.crearCircuito);
    router.put("/:id", controller.modificarCircuito);
    router.patch("/:id/baja", controller.darDeBaja);

    return router;
  }
}
```

---

## Reglas generales

### Errores
- Usar **siempre** `CustomError` para errores conocidos (400, 404, 403, etc.)
- El controller propaga con `next(error)`, **nunca** con `res.status().json()` dentro del catch
- El middleware global `manejadorErrores` convierte `CustomError` en respuesta HTTP

### Bajas
- Siempre **baja lógica** con campo `estado` → `"INACTIVO"`
- **Nunca usar DELETE** en la base de datos
- Antes de dar de baja, verificar dependencias activas

### Base de datos
- El cliente Prisma se importa como `db` desde `../../config/postgresDatabase`
- **Nunca** crear un `new PrismaClient()` en un servicio o controller
- Transacciones con `db.$transaction()` cuando se tocan varias tablas

### Parámetros de ruta (Express 5)
- `req.params.id` devuelve `string | string[] | undefined`
- Siempre castear: `parseInt(req.params.id as string)`

### Registro de rutas en app.ts
```typescript
import { CircuitoRoutes } from "./modulos/catalogo/circuito.routes";
app.use("/api/circuitos", CircuitoRoutes.getRoutes);
```

---

## Convención de nombres de endpoints

Cada método de controlador del DCD es un endpoint:

```
ControladorCircuitos.consultarCircuitos  → GET    /api/circuitos
ControladorCircuitos.crearCircuito       → POST   /api/circuitos
ControladorCircuitos.modificarCircuito   → PUT    /api/circuitos/:id
ControladorCircuitos.darDeBajaCircuito   → PATCH  /api/circuitos/:id/baja
```

---

## Prompt sugerido para la IA

Si tu compañero quiere que la IA le genere un CRUD nuevo, puede usar este prompt:

> "Necesito crear el CRUD de [ENTIDAD] para el backend de IncaTour.
> Seguí las convenciones del archivo CONVENTIONS.md que está en la raíz del backend.
> Los archivos van en src/modulos/[MODULO]/ con esta estructura:
> entidad.dto.ts, entidad.routes.ts, entidad.controller.ts, entidad.service.ts, entidad.repository.ts.
> El repositorio es la única capa que importa `db` desde config/postgresDatabase.
> Los errores se manejan con CustomError y next(error).
> Las bajas son lógicas con estado INACTIVO, nunca DELETE.
> Mirá el módulo de circuitos en src/modulos/catalogo/ como referencia."
