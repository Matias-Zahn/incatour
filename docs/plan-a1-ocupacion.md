# Plan A1: ocupación por fechas

**Estado:** propuesta. No se toca código hasta que se autorice.
**Rama:** `feat/ocupacion-por-fechas`, desde `main`.

## Alcance
A1 cambia **cómo se guarda y se calcula el stock**. No cambia lo que hace el admin: sigue eligiendo a mano en CU-40 y CU-39. La asignación automática, el estado PROVISORIA, el transporte elegido al crear la salida y la regla del 50 % quedan para A2, que se apoya en esto.

**Queda fuera:**
- El **personal**, que ya se controla por fechas con `AsignacionPersonal`.
- `Salida.stockLocal` y `Salida.stockLocalAlojamiento`. Son contadores **internos de cada salida**: los lugares que le quedan a la venta y las plazas del bloqueo sin vender. No son stock de un proveedor y funcionan bien.

## 1. Modelo

```prisma
model Ocupacion {
  idocupacion        Int          @id @default(autoincrement())
  idservicio         Int
  idsalida           Int
  tipo               String       // ALOJAMIENTO | TRANSPORTE | EQUIPAMIENTO
  desde              DateTime     @db.Date
  hasta              DateTime     @db.Date // inclusive
  cantidad           Int          // plazas, unidades, o 1 para un vehículo
  comprobanteReserva String?      // solo TRANSPORTE (CU-39), viene de SalidaServicio
  creadaEn           DateTime     @default(now())
  servicio           ServicioBase @relation(fields: [idservicio], references: [idservicio])
  salida             Salida       @relation(fields: [idsalida], references: [idsalida])
  @@index([idservicio, desde, hasta])
  @@index([idsalida])
  @@schema("public")
}
```

- **Se eliminan `SalidaServicio` y `SalidaEquipamiento`.** Sus datos se migran a `Ocupacion`.
- **Sin `@@unique`:** el hotel puede ocupar dos tramos, las noches previas y las posteriores, porque durante el trekking el grupo acampa. La regla es simple: cambiar la ocupación de un servicio en una salida es borrar sus filas y volver a crearlas.
- **Una salida tiene como máximo un transporte y un hotel.** Hoy lo garantiza `@@unique([idsalida, tipo])` de `SalidaServicio`. Ahora se valida en el código, dentro de la transacción, que ya bloquea la salida.
- **Renombres, que pasan a ser el total y no cambian con el uso:**
  - `ServicioEquipamiento.cantidadDisponible` → `cantidadTotal`
  - `ServicioAlojamiento.capacidadDisponible` → `plazasTotales`
  - El transporte tiene un solo vehículo, así que su total es 1 de forma implícita.

## 2. Cálculo (`backend/src/shared/ocupacion.ts`)

Son funciones puras, sin base de datos:

```ts
ocupadoPorDia(ocupaciones, desde, hasta): Map<string /*AAAA-MM-DD*/, number>
disponibleEnRango(total, ocupaciones, desde, hasta): number   // total − máximo diario
rangosDe(tipo, salida, definicion): { desde, hasta }[]
```

- **Rangos por tipo:**
  - **Alojamiento:** las noches previas van de `inicio − nochesPrevias` a `inicio − 1`, y las posteriores de `fin` a `fin + nochesPosteriores − 1`. Las noches salen del paquete congelado (`definicionPaquete`). Si las dos son 0, no hay ocupación de hotel.
  - **Transporte:** de `inicio` a `fin`.
  - **Equipamiento:** de `inicio` a `fin + DIAS_REACONDICIONAMIENTO`, que vale 2 en `constantes.ts` (decidido: entre 2 y 3 días; se ajusta en un solo lugar).
- **Qué ocupaciones cuentan:** solo las de salidas en `SALIDAS_ACTIVAS`.
  - Las de salidas FINALIZADAS se conservan como historial, pero no ocupan. Si una salida termina antes de tiempo, el recurso se libera en ese momento.
  - Las de salidas CANCELADAS se borran.

**Repositorio común** (`backend/src/shared/ocupacion.repository.ts`):

```ts
bloquearServicio(tx, idservicio)                         // SELECT … FOR UPDATE sobre ServicioBase
ocupacionesDe(tx, idservicios[], desde, hasta, excluirIdsalida?)
disponible(tx, idservicio, rangos, excluirIdsalida?)    // bloquear antes, después calcular
ocupar(tx, { idservicio, idsalida, tipo, rangos, cantidad, comprobante? })
liberar(tx, idsalida, idservicio?)                       // borra
```

- **Concurrencia:** el orden de bloqueo es Salida → Personal → ServicioBase, el mismo que ya está documentado en `logistica.repository`. Dos cierres que se disputan la última carpa se serializan por el bloqueo de `ServicioBase`.

## 3. Qué cambia en cada evento

| Evento | Hoy | Con A1 |
|---|---|---|
| **CU-36 crear salida** (`salida.repository.crearSalida`, `buscarAlojamientosConBloqueo`) | `capacidadDisponible -= tamanoMaximo` | Se bloquea el hotel, se exige `disponible(noches) >= tamanoMaximo` y se crea la ocupación. La lista de hoteles muestra lo disponible en las fechas de la salida, no el contador |
| **CU-30 compra** | Usa `stockLocalAlojamiento` de la salida | Sin cambios |
| **CU-32 cancelar reserva, con la salida en venta** | `stockLocalAlojamiento += pax` | Sin cambios: la plaza sigue dentro del bloqueo |
| **CU-32 cancelar reserva, con la salida cerrada** (`gestion-reserva.repository`) | `capacidadDisponible += pax` | Baja `cantidad` en la ocupación de hotel de la salida |
| **CU-40 cerrar salida** (`asignacion.repository.confirmar`) | Descuenta equipo, crea `SalidaServicio` de transporte y devuelve los sobrantes de hotel a `capacidadDisponible` | Crea la ocupación de cada equipo y del transporte, con control de disponible. La ocupación de hotel baja en `stockLocalAlojamiento` |
| **CU-39 modificar logística** (`logistica.repository`) | Desasignar repone y asignar descuenta | Desasignar es `liberar`, asignar es `disponible` + `ocupar`. Cambiar la cantidad de un equipo pasa a ser una sola operación |
| **CU-37 cancelar salida** (`cancelacion-salida.repository`) | `plazasADevolverAlHotel` más la reposición de equipo | `liberar(tx, idsalida)`. Se borran `cancelacion-salida.plazas.ts` y su test |
| **Finalizar, último avance** (`guia.repository`) | Devuelve plazas al hotel | Nada: la ocupación queda como historial y deja de contar |
| **CU-41 devolución** (`devolucion-equipamiento.*`) | Las unidades en buen estado vuelven a `cantidadDisponible` | Las de buen estado no hacen nada, porque vuelven solas por fecha. Las dañadas y las faltantes bajan `cantidadTotal`, con auditoría. Sigue sin poder registrarse dos veces |
| **Proveedores, alta y edición de servicio** (`servicio.service/dto/repository`) | Se edita el disponible | Se edita el total. Subirlo es libre. Bajarlo se rechaza si queda por debajo del máximo ocupado de hoy en adelante: "Hay 28 carpas comprometidas el 12/03". Las bajas por rotura o pérdida se registran en CU-41 |
| **Paneles de disponibles** (`logistica.disponiblesEquipamiento`, `disponiblesTransporte`) | Equipo con `cantidadDisponible > 0`, sin mirar fechas | Lo disponible **para las fechas de la salida**. Los que dan 0 no se listan |

**Nuevo endpoint para el historial y el calendario del front nuevo:**
`GET /api/servicios/:idservicio/ocupacion?desde&hasta` devuelve `{ total, dias: [{ fecha, ocupado, disponible }], ocupaciones: [{ nroSalida, desde, hasta, cantidad, estadoSalida }] }`. Es solo de lectura y lo usa el ADMIN.

**Compatibilidad con el front actual:** hasta que se reemplace, las respuestas mantienen los nombres de los campos (`cantidadDisponible`, `capacidadDisponible`, `stockActualDisponible`). Ahora quieren decir "disponible hoy", o "disponible en las fechas de la salida" en los paneles. Así el front viejo sigue andando mientras se diseña el nuevo.

## 4. Migración

Es una sola migración SQL con conversión de datos:
1. Crear `Ocupacion` y las columnas `cantidadTotal` y `plazasTotales`.
2. **Equipamiento:** `cantidadTotal = cantidadDisponible + Σ` lo de `SalidaEquipamiento` de salidas no canceladas que todavía no registraron la devolución. Esas unidades siguen afuera.
3. **Hotel:** `plazasTotales = capacidadDisponible + Σ` lo que tiene comprometido cada salida activa:
   - PUBLICADA: `tamanoMaximo`;
   - CERRADA o EN_CURSO: las plazas de las reservas confirmadas que salieron del bloqueo, con la regla de `plazasADevolverAlHotel` aplicada en SQL.
4. **Copiar a `Ocupacion`:**
   - `SalidaEquipamiento` → EQUIPAMIENTO;
   - `SalidaServicio` TRANSPORTE → cantidad 1, con su comprobante;
   - `SalidaServicio` ALOJAMIENTO → la cantidad del paso 3, con los rangos de noches.

   Se incluyen las finalizadas, para que quede el historial.
5. Borrar `SalidaServicio`, `SalidaEquipamiento`, `cantidadDisponible` y `capacidadDisponible`.

**Bases:** se prueba primero en `incatour_demo_prueba`, después se regenera `incatour_demo` con `npm run demo`. **`incatour_db` se toca solo con tu autorización.**

## 5. Tests y scripts

**Unitarios nuevos:**
- `shared/ocupacion.test.ts`: superposición en los bordes (el mismo día, el día siguiente), el máximo diario en vez de la suma, las noches previas y posteriores en dos tramos, el reacondicionamiento y los rangos vacíos.

**Unitarios a ajustar:**
- `asignacion.service.test.ts`
- `salida.service.test.ts`
- `servicio.service.test.ts` y `servicio.dto.test.ts`
- `logistica`, `devolucion-equipamiento` y `cancelacion-salida`, si mockean esos campos
- `cancelacion.caja-blanca.test.ts`: la rama "salida cerrada con alojamiento por stock" cambia de implementación. Hay que volver a medir la cobertura, que tiene que seguir en 100 %, y anotar que el documento de caja blanca se actualiza para el final.

**Scripts:**
- `scripts/integral/salidas.ts`, con 25 referencias, es el que más se toca. También `ventas.ts`, `contexto.ts`, `campo.ts` y `catalogo-cuentas.ts`, más `demo.ts`, `prueba-humo.ts` y `prueba-concurrencia.ts`.

**Escenarios nuevos de la integral:**
1. Dos salidas en fechas distintas usan las mismas 30 carpas sin chocar. Es el caso que hoy falla.
2. Dos salidas superpuestas se disputan las últimas carpas en cierres simultáneos: entra una sola.
3. Dos salidas superpuestas piden el mismo hotel: la segunda ve solo lo que queda.
4. El hotel no queda ocupado durante el trekking: otra salida puede usar esas noches.
5. Bajar el total por debajo de lo comprometido se rechaza.
6. Una devolución con 2 carpas dañadas deja el total en 28.
7. Cancelar una salida libera todo de inmediato.

**Verificación:**
- `tsc`, `vitest`, `test:caja-blanca`, `test:integral`, `test:humo` y la prueba de concurrencia, todos en verde.
- `npm run demo` sobre una base temporal, y revisión a mano de los paneles de CU-36, CU-40 y CU-39 en el front actual.

## 6. Tamaño estimado
- **Back:** unos 12 archivos de producción y una migración, con más líneas borradas que agregadas, porque desaparecen las 8 reposiciones manuales.
- **Tests y scripts:** unos 10 archivos.
- **Entrega:** un solo PR.

## Respuestas (2026-11-15)
1. El hotel se usa solo en las noches previas y posteriores. Confirmado.
2. El reacondicionamiento es de 2 días.
3. Se mantienen los nombres de los campos. Si alguno tiene que cambiar, se avisa.
4. Bajar el total por debajo de lo comprometido se rechaza. Las bajas solo se dan por rotura o pérdida.

## Preguntas originales
1. **Hotel durante el trekking:** ¿el grupo no usa el hotel en esos días? Asumo que no, porque acampa, y por eso ocupo solo las noches previas y posteriores.
2. **Reacondicionamiento:** ¿alcanza con 1 día de lavado y revisión entre salidas, igual para todo el equipo?
3. **Front viejo:** ¿mantengo los nombres de los campos en las respuestas para que siga funcionando hasta que esté el nuevo? Recomiendo que sí.
4. **Total por debajo de lo comprometido:** ¿se rechaza, como propongo, o se permite con una alerta?
