# Trabajar el back con IA y corregir los errores de la revisión

En la revisión del 20/10 aparecieron **68 errores** en el back: los encontró la prueba de humo (`npm run test:humo`) y cinco revisores automáticos, y cada uno se verificó contra el código. Casi ninguno era del camino feliz: eran reglas del ERS que faltaban, permisos, concurrencia, compensaciones con servicios externos y columnas sin migrar. Los tests unitarios no los veían porque mockean el repositorio.

Esta guía tiene dos partes:

1. [Reglas para trabajar con IA](#1-reglas-para-trabajar-con-ia): qué pedirle, qué revisar y cuándo un cambio está terminado.
2. [Cómo corregir el listado de errores](#2-cómo-corregir-el-listado-de-errores): el tablero, el paso a paso y los bloques en que se puede repartir.

**Tablero de errores:** https://claude.ai/artifact/8r1qK3dWbt3rfKFJRFa7T1. Cada error tiene su código (`SEG-01`, `RES-01`…), qué pasa, cómo reproducirlo, dónde está y un estado que se cambia ahí mismo.

---

## 1. Reglas para trabajar con IA

### 1.1 Qué darle a la IA antes de pedir código

Un pedido como "implementá el CU-07" deja que la IA invente las reglas que no conoce. Así salieron, por ejemplo, las temporadas que se superponen (RF-11) o el comentario "el campo `estadoAlojamiento` no existe" sobre un campo que sí existía.

Pasale siempre:

- **El texto del CU** (del modelo de casos de uso) y **las reglas de negocio y los RF** que lo afectan, copiados del ERS. Son los criterios de aceptación.
- **El schema real:** los modelos de `prisma/schema.prisma` que toca. Que no los adivine.
- **El contrato:** `docs/CONTRATO_API.md` y la parte del `openapi.json` del endpoint.
- **Un módulo vecino como ejemplo**, para que copie las convenciones (capas, DTO, `CustomError`, `{ data }`).

### 1.2 Qué pedirle que analice antes de escribir código

Pedile que responda esto **antes** de programar. Es donde están la mayoría de los errores de la revisión:

1. **Reglas:** listá cada regla de negocio del CU y cómo la vas a validar.
2. **Dueño del dato:** para cada ruta, ¿quién puede leer o modificar este recurso? Un cliente nunca puede ver ni tocar datos de otro (`SEG-01`).
3. **Puntos de falla:** si hay un servicio externo (autoridad, pasarela, notificador), armá una tabla: "si falla el paso N, ¿qué queda en el externo y qué en la base?, ¿cómo se compensa?, ¿se puede reintentar?" (`SAL-01`, `SAL-04`, `INT-06`).
4. **Concurrencia:** ¿qué pasa si llegan dos pedidos iguales a la vez? Todo lo que es "leer, validar y escribir" sobre stock, cupos, estados o turnos tiene que ser atómico (`SAL-08`, `INT-04`, `CTA-06`).
5. **Estados:** ¿de qué estados se puede pasar a cuáles? Usá siempre las constantes de `shared/constantes.ts`, nunca un texto suelto (`CTA-01`: `"Confirmada"` contra `"CONFIRMADA"`; `CAT-02`: se olvidó `PUBLICADA`).

### 1.3 Patrones del proyecto (usalos en vez de inventar)

| Problema | Patrón |
|---|---|
| Stock, cupo o estado que no puede cambiar dos veces | `updateMany` con la condición en el `where` y mirar `count`: si es 0, otro pedido ganó. Ejemplo: `reservarCupos` en `reserva.repository.ts`. |
| Llamada a un servicio externo | Fuera de `db.$transaction`. Si la base falla después, se compensa con la operación inversa. La compensación tiene que poder reintentarse sin romper nada (idempotente). |
| El externo no responde | `CustomError.serviceUnavailable` (503), no 500. |
| Recurso de un usuario | Comparar el id de la URL con `req.usuarioAutenticado`. Si no coincide, 403. |
| Números que van a una columna `Int` | `Number.isInteger`, no solo `typeof === "number"`: un decimal llega a Prisma y da 500 (`CAT-11`). |
| Columna nueva | Siempre con migración: `npx prisma migrate dev --name ...`. Nunca tocar la base local a mano (así aparecieron `datosContacto` y `comprobanteReserva`). |
| Datos que vienen del cliente | Validar el tipo en el DTO, aunque "siempre llegue bien". Un número donde se esperaba texto tumbó el servidor (`INT-01`). |

### 1.4 Cuándo un cambio está terminado

Antes de abrir el PR, todo esto tiene que pasar. Desde `backend`, con Docker levantado:

```bash
npx tsc --noEmit
```
```bash
npm test
```
```bash
npm run test:humo
```

Y además:

- **Un test por regla de negocio** del CU, incluidos los flujos alternativos, no solo el camino feliz.
- **Si tocaste un flujo con servicio externo:** un test donde el externo falla y otro donde la base falla después del externo.
- **Si agregaste o cambiaste un endpoint:** actualizaste su comentario `@swagger` y corriste `npm run docs`.
- **Si la prueba de humo no pasa por tu caso nuevo:** agregalo en `scripts/prueba-humo.ts` (fase C).
- **Revisión:** antes del merge, pedile a la IA una revisión del diff contra el CU (en Claude Code, `/code-review`). Revisá vos lo que marque. Los revisores automáticos también se equivocan.

### 1.5 Lo que `tsc` y los tests unitarios no ven

- **Campos de Prisma dentro de `select`, `include`, `where` o `create` anidados:** si el campo no existe, `tsc` muchas veces no avisa y Prisma falla recién al ejecutar. Lo detecta la prueba de humo, si pasa por ese camino.
- **Errores contra la base real:** los tests unitarios mockean el repositorio. Si el repositorio arma mal la consulta, el test da verde igual.
- **Carreras:** el mock de la autoridad (`AutoridadMock`) es atómico y la versión del servidor (`AutoridadSimulada`) no (`INT-05`). Un test que pasa con el mock no prueba que no haya carrera.

---

## 2. Cómo corregir el listado de errores

### 2.1 Paso a paso para cada error

1. **Elegí un error del tablero** y pasalo a **En curso**, así nadie más lo toma.
2. **Creá una rama:** `fix/<código>-<algo-corto>`, por ejemplo `fix/RES-01-estado-alojamiento`. Si arreglás varios del mismo bloque juntos, una rama por bloque.
3. **Primero reproducilo.** Escribí el test que falla: unitario para reglas y validaciones, o un paso nuevo en la prueba de humo si depende de la base. Si no lo podés reproducir, anotalo en el tablero y avisá: puede ser un falso positivo.
4. **Arreglalo** siguiendo los patrones de la sección 1.3.
5. **Corré todo lo de la sección 1.4.** El test del paso 3 tiene que pasar.
6. **Abrí el PR** con el código del error en el título, por ejemplo `fix(RES-01): confirmar el alojamiento al aceptar la solicitud`.
7. **En el tablero,** pasalo a **Arreglado** y anotá el número de PR en la nota.

Si al mirarlo resulta que no es un error (por ejemplo, una decisión de diseño acordada), pasalo a **Descartado** y escribí el motivo en la nota.

### 2.2 Prompt para pedirle a la IA que arregle un error

Copiá los datos del error desde el tablero:

```text
Contexto: backend de IncaTour (Express 5 + TypeScript + Prisma 5 + PostgreSQL).
Convenciones: capas route → controller → service → repository, DTOs con static create,
CustomError, respuestas { data } y errores { error }. Leé backend/docs/TRABAJO_CON_IA.md.

Error a corregir: <código> — <título>
Qué pasa: <detalle del tablero>
Cómo se reproduce: <reproducir del tablero>
Dónde: <archivo y línea>
Regla del ERS / CU: <pegá el texto del CU o RF>

Antes de cambiar código:
1. Confirmá el error leyendo el código y explicame la causa.
2. Escribí un test que falle por este error.
3. Proponé el arreglo mínimo y decime qué otros lugares usan lo mismo (grep),
   para no dejar el mismo error en otro archivo.
Después arreglalo, y corré tsc, los tests y npm run test:humo.
No cambies nada fuera de este error.
```

### 2.3 Bloques para repartir

Cada integrante del back corrige los errores de los módulos que escribió, así nadie arregla código que no conoce y dos personas no tocan los mismos archivos. Empezá por los de severidad alta.

| Integrante | Errores | Carpetas |
|---|---|---|
| **Matias** (16) | CAT-01, 02, 03, 04, 06, 07, 08, 11, 13, 14, 15 · RES-01, 04, 05, 09, 10 | `catalogo/**`, `reservas/solicitudes` |
| **Alexis** (17) | SEG-01, 02, 04, 05 · CTA-01, 02, 03 · CAT-09, 10, 12 · RES-03, 07, 12 · SAL-02, 03, 07, 08 | `cuentas/clientes`, `cuentas/cuenta-guia`, `shared/auth`, `proveedores/**`, `shared/upload`, `reservas/reservas`, `reservas/gestion-reservas`, `reservas/resenias`, `salidas/cancelacion-salida`, `salidas/logistica`, `salidas/devolucion-equipamiento` |
| **Martin** (25) | Todo lo de servicios externos y autoridad: INT-01 a INT-11, SAL-01, SAL-12, RES-02, RES-08, RES-11 · y además SAL-04, 05, 06, 09, 10 · CTA-04, 05, 06 · SEG-06 | `integraciones/**`, `salidas/asignacion`, `salidas/reemplazos`, `campo/guia`, `cuentas/personal`, `app.ts`, `error/`, y en los módulos de otros solo las llamadas a la autoridad, la pasarela o el notificador |

Los errores de Martin en módulos ajenos (SAL-01 y SAL-12 en la cancelación, RES-02 y RES-11 en la compra, RES-08 en solicitudes) tocan archivos de Alexis o Matias: coordinen el orden de merge con el dueño del módulo.

Si necesitás cambiar `prisma/schema.prisma`, avisá en el grupo antes de crear la migración, y se mergea de a una.

**Para decidir en grupo antes de tocar código** (cambian el diseño o el alcance):

- **SEG-03:** sacar el `.env` del repo, descomentar `.env` en `.gitignore` y cambiar el `JWT_SEED`. Cada integrante tiene que recrear su `.env` desde `.env.example`.
- **CAT-05:** que las salidas conserven la definición del paquete con la que se crearon (requiere cambiar el modelo).
- **RES-06:** si la cancelación aplica las condiciones comerciales o se documenta el reintegro del 100% como simplificación.
- **SAL-11:** si el permiso reemplazado queda "Perdido" (como dice el RF-48) o "Dado de baja" (como está hoy).

### 2.4 Por dónde empezar

Estos son los que más daño hacen o bloquean otras partes. Cada uno, empezá por los tuyos:

- **Matias:** RES-01 (aceptar una solicitud no confirma el alojamiento, y la asignación del CU-40 nunca puede cerrar esas salidas), CAT-02 (se puede dar de baja un paquete con salidas a la venta; es una línea), CAT-01, CAT-03 y CAT-04.
- **Alexis:** SEG-01 y SEG-02 (un cliente modifica a otro y un cliente dado de baja sigue entrando), CTA-01, SAL-03 (la devolución se registra varias veces e infla el stock) y SAL-02.
- **Martin:** INT-01 (un número de tarjeta numérico tumba el servidor entero), SAL-01, SAL-04 y RES-02.
- **Grupo:** SEG-03 (el `.env` con la clave de los tokens está en el repo), en cuanto se decida.
