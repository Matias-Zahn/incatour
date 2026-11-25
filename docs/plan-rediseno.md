# Plan: rediseño de recursos y front nuevo

## Diagnóstico (lo que hay hoy)

| Recurso | Cómo se controla hoy | Problema |
|---|---|---|
| Equipamiento | `ServicioEquipamiento.cantidadDisponible`, un contador global. Se descuenta en CU-40 y se repone a mano en CU-41 | No conoce fechas: una salida de marzo y una de abril compiten por el mismo número. Si nadie registra la devolución, el stock se pierde |
| Alojamiento | `ServicioAlojamiento.capacidadDisponible`, otro contador global. Se descuenta `tamanoMaximo` al crear la salida (CU-36) y se repone en 4 lugares distintos (cierre, cancelación de reserva, cancelación de salida, finalización) | Igual que el equipamiento: bloquea el hotel para todas las fechas, no solo para las noches de la salida |
| Transporte | Se cruzan fechas contra `SalidaServicio` (la consulta de `logistica.repository.ts`) | Es el único que está bien, pero se elige dos veces: como servicio incluido del paquete (para el equipaje) y otra vez al asignar recursos |
| Personal | Superposición de fechas contra `AsignacionPersonal` | Bien, pero el admin elige uno por uno |
| Cantidades | El admin escribe cuántas carpas o bolsas lleva cada salida | Es carga manual propensa a errores: el sistema ya sabe los pasajeros desde la compra |
| Mínimo de pasajeros | No existe: se puede cerrar con 1 pasaje vendido | No hay resguardo económico |
| Precio | La tarifa por temporada se escribe a mano y no tiene relación con el `costoBase` de los servicios | No se ve el costo, ni el margen, ni si el paquete se vende a pérdida |

---

## Parte A: back

### A1. Ocupación por fechas

Reemplaza todos los contadores por una tabla de ocupaciones, que además funciona como historial de cada recurso.

```prisma
model Ocupacion {
  idocupacion Int      @id @default(autoincrement())
  idservicio  Int
  idsalida    Int
  desde       DateTime // primer día ocupado
  hasta       DateTime // último día ocupado (inclusive)
  cantidad    Int      // plazas, unidades o 1 vehículo
  estado      String   // PROVISORIA | CONFIRMADA
  @@unique([idservicio, idsalida])
}
```

- **Capacidad total:** `capacidadDisponible` pasa a `plazasTotales` y `cantidadDisponible` a `cantidadTotal`. Dejan de bajar y subir: representan lo que el proveedor tiene.
- **Disponible por día:** `disponible(d) = total − Σ ocupaciones que cubren el día d`. Por ejemplo, con 30 carpas y 5 ocupadas el 12/03, ese día hay 25.
- **Disponible para un rango:** el mínimo de `disponible(d)` entre `desde` y `hasta`. Es una sola función en `shared/ocupacion.ts`, que usan todos los módulos. Las salidas duran 30 días como máximo, así que se recorren los días en memoria.
- **Concurrencia:** dentro de la transacción, `SELECT … FROM "ServicioBase" WHERE idservicio = … FOR UPDATE`, después se calcula lo disponible y se inserta. Es el mismo patrón que ya se usa con `Salida`.
- **Rango de cada tipo:**
  - Hotel: las noches reales, según `nochesPrevias` y `nochesPosteriores` del paquete congelado.
  - Transporte y personal: del inicio al fin de la salida.
  - Equipamiento: del inicio al fin, más `DIAS_REACONDICIONAMIENTO = 2` para lavado y revisión.
- **Reemplaza a `SalidaServicio` y `SalidaEquipamiento`.** Se borran los `increment` y `decrement` de 8 archivos: `guia.repository`, `gestion-reserva.repository`, `cancelacion-salida.repository`, `asignacion.repository`, `logistica.repository`, `salida.repository`, `reserva.repository` y `devolucion-equipamiento.repository`.
- **Qué pasa en cada evento:**
  - Cancelar una salida borra sus ocupaciones.
  - Finalizarla no hace nada, porque la fecha ya pasó.
  - La devolución (CU-41) deja de reponer stock y solo registra faltantes o roturas, que bajan `cantidadTotal` con motivo.

### A2. Requerimientos y asignación automática

- **Requerimientos de equipamiento.** Nueva tabla `RequerimientoEquipamiento(idcircuito, tipoEquipamiento, cantidad, cadaPasajeros)`. Por ejemplo, 1 carpa cada 2 pasajeros o 1 bolsa de dormir por pasajero.
- **Dotación de porteadores.** El `parametrosPorteadores` en texto, que hoy se lee con una regex, pasa a dos enteros.
- **`necesidades(salida, pasajeros)`** calcula, en una función pura y testeable, los guías, porteadores, cada tipo de equipo, las plazas de hotel y la capacidad de vehículo.
- **Hotel y transporte al crear la salida (CU-36).** El admin elige el hotel, como ya hace, y el transporte, con capacidad para `tamanoMaximo`. Los dos quedan ocupados desde ese momento.
  - El transporte deja de estar en los servicios del paquete.
  - **Equipaje (decidido el 2026-11-15):** sale de la compra. El cliente no declara peso y el sistema no cobra excedente: se pesa y se cobra en persona en el punto de encuentro, por fuera del sistema. Hay que quitar `equipaje` de `POST /reservas` y `adicionalesEquipaje` de `calcularPrecio` y del desglose congelado, y ajustar los casos de caja negra de la compra.
    - `ponytail:` más adelante se podría ofrecer equipaje extra prepago como un adicional de la compra.
  - Así se termina el "vuelve a pedir el transporte".
- **En cada compra (CU-30), dentro de la misma transacción**, se recalculan las necesidades de equipamiento y se ajustan las ocupaciones `PROVISORIAS`. Se usa primero el proveedor que la salida ya tiene, y si no, el primero con disponible. Cancelar una reserva (CU-32) reduce esas ocupaciones.
- **Panel de cierre (CU-40).** `GET propuesta` devuelve todo precargado:
  - personal libre, habilitado y con menos salidas en el mes;
  - el transporte y el hotel ya ocupados;
  - el equipo provisorio.

  `POST confirmar` acepta la propuesta tal cual o con cambios puntuales, y pasa las ocupaciones a `CONFIRMADA`. El admin revisa, no arma.
- **Modificar logística (CU-39)** queda para excepciones y trabaja sobre `Ocupacion`.
- **Alerta `FALTA_RECURSO`** en `resumirSalida`: aparece cuando una necesidad no tiene ocupación suficiente. Por ejemplo, cuando no hubo stock al comprar.

### A2b. Control de stock al crear una salida

La venta nunca se bloquea por falta de equipo. El control está antes, al crear la salida, para que no se publiquen salidas sin respaldo.

- **Demanda máxima de una salida:** `necesidades(salida, tamanoMaximo)`, es decir, lo que necesitaría si se vende completa.
- **Demanda proyectada de un día:** se suma la de cada salida activa que cubre ese día:
  - si todavía no cerró, el máximo entre lo que ya tiene ocupado y su demanda máxima;
  - si ya cerró, lo que tiene ocupado de verdad.
- **Regla al crear (CU-36), para cada día del rango y cada tipo de equipo:** `libre = total − demanda proyectada de las otras salidas`.
  - **`libre < 50 %` de la demanda máxima de la nueva:** no se crea. El 409 detalla el tipo, el día y cuánto falta, y sugiere el tamaño máximo con el que sí cumple. La constante es `COBERTURA_MINIMA_STOCK = 0.5`.
  - **`libre` entre el 50 % y el 100 %:** se crea, con una advertencia en pantalla y la alerta `RIESGO_STOCK`, por ejemplo "si se vende completa faltarían hasta 3 carpas el 12/03". Así el admin tiene tiempo de comprar o alquilar.
  - **`libre >= 100 %`:** se crea sin aviso.
- **Durante la venta:** si la demanda real supera lo disponible, `RIESGO_STOCK` pasa a `FALTA_RECURSO`. Las dos alertas aparecen en la bandeja "Hoy" con los días que faltan para la salida.
- **Hotel y transporte:** se ocupan completos al crear la salida (A2), así que para ellos la regla es exacta: tiene que alcanzar el 100 %.

### A3. Resguardo de mínimo de pasajeros

- **Campos nuevos en `Paquete`**, congelados en `definicionPaquete`:
  - `minimoPasajeros`: con cuántos pasajeros la salida es rentable.
  - `diasDecision`: cuántos días antes del inicio se decide si sale.
- **CU-40 rechaza el cierre** si `vendidos < minimoPasajeros`, con un 409: "Tiene 1 de 6 pasajeros mínimos. Esperá más ventas o cancelá la salida."
- **Alerta `BAJO_MINIMO`:** cuando `hoy >= fechaInicio − diasDecision` y falta gente. Ofrece cancelar (CU-37), con reintegro del 100%, que ya existe para las cancelaciones de la agencia.
- **Para el cliente:** cuando se alcanza el mínimo, la salida figura como "Salida confirmada" en el catálogo, que es lo habitual en turismo. Además, la compra avisa que, si no se llega al mínimo, se reintegra el 100%.

### A4. Costo y margen

- **Unidad de `costoBase` según el tipo:**
  - hotel: por plaza y por noche;
  - transporte: por salida;
  - equipamiento: por unidad y por salida;
  - tren: por pasajero.
- **`costoEstimado(paquete)`** = costos variables por pasajero + costos fijos / `minimoPasajeros`.
- **El formulario de tarifas** muestra el costo y el margen de cada temporada, y avisa si una tarifa queda por debajo del costo. El precio lo sigue decidiendo el admin.

- **Por fases:**
  1. Hotel, transporte y tren, con el `costoBase` que ya existe.
  2. Equipo, cuando estén los requerimientos de A2.
  3. Personal (`Personal.costoDiario`) y permisos (`Circuito.costoPermisoPorPersona`).
- **Endpoints:**
  - `GET /paquetes/:id/costos?pasajeros=N`
  - `POST /paquetes/costos/simular`, para el formulario
  - `GET /salidas/:id/costos`, con el costo real
- **Moneda:** todo en USD (confirmado el 2026-11-16).
- **Ganancia estimada** (pedido del usuario: es una estimación, no un número contable):
  - **Al fijar precios** (paquete): ganancia por salida en tres escenarios, con el mínimo de pasajeros, con el 75 % y completa: `tarifa × pasajeros − costo(pasajeros)`. Hay una tabla por temporada, y se marca en rojo si con el mínimo da pérdida.
  - **En cada salida:** hay dos números.
    - **Ganancia actual:** lo cobrado menos los reembolsos, menos el costo. El costo es real si la salida ya tiene recursos asignados, y estimado si no.
    - **Ganancia proyectada:** cuánto daría si se vende completa.
  - Lo devuelven los mismos endpoints de costos, en un campo `ganancia: { minimo, setentaYCinco, completa }` para el paquete, y `{ actual, proyectada }` para la salida.

### A4b. Teléfonos de emergencia (decidido el 2026-11-15)
- **Personal:** `Personal.telefono`, para "Llamar al guía" desde la bandeja Hoy.
- **Agencia:** `TELEFONO_EMERGENCIA_AGENCIA` en la configuración (`envs`). Lo ve el guía en su ficha.
- **Pasajero:** `Pasajero.contactoEmergenciaNombre` y `contactoEmergenciaTelefono`, obligatorios en la compra (CU-30), igual que el pasaporte.
- **Lo gestiona la agencia, no el guía.** El guía no ve los contactos de los pasajeros: llama a la agencia o reporta el incidente. Los contactos aparecen:
  - para el admin, en el detalle del incidente y de la salida;
  - en el mail de incidente crítico, que suma el contacto de cada pasajero afectado.

### A4c. Guía: presentismo y finalización a mano (decidido el 2026-11-16)
- **Presentismo:**
  - `POST /guia/salidas/:id/iniciar` acepta `ausentes: idpasajero[]`, opcional.
  - Se guarda en `ReservaPasajero.presente` (Boolean, null = sin registrar). Se puede corregir hasta el primer avance.
  - Es un no-show: no genera reintegro ni libera lugares, y el permiso ya está emitido.
  - El admin ve los ausentes en la ficha de la salida y en Hoy. El guía, en la lista de pasajeros.
- **Finalizar a mano:**
  - `POST /guia/salidas/:id/finalizar` con `motivo` obligatorio. Lo puede hacer el guía asignado, y también el admin desde la ficha.
  - Solo con la salida EN_CURSO. La pasa a FINALIZADA con `fechaHoraFinReal`.
  - Las etapas que no se informaron quedan sin informar.
  - Deja un registro en auditoría y le avisa al admin por mail.
  - Tiene que ser idempotente, por la cola offline.
- **Después:** recuperar la contraseña, para el cliente y el admin.

### A5. Migración, tests y documentación

- **Una migración con conversión de datos:**
  - `cantidadTotal = cantidadDisponible + Σ` de lo asignado a salidas activas.
  - `plazasTotales = capacidadDisponible + Σ` de lo bloqueado por salidas activas.
  - `SalidaServicio` y `SalidaEquipamiento` se copian a `Ocupacion`.
  - Antes de correrla sobre `incatour_db`, pedir autorización.
- **Scripts:** `demo.ts`, `scripts/integral/*`, `prueba-humo.ts` y `prueba-concurrencia.ts`. La concurrencia suma un caso nuevo: dos compras que se disputan la última carpa.
- **Tests que se rehacen:** los de asignación, logística, devolución, cancelación de salida, reserva, gestión de reserva y alta de salida. Caja blanca de CU-32: revisar que siga en 100% después de cambiar la reposición.
- **Casos de uso que cambian:** CU-30, CU-32, CU-36, CU-37, CU-39, CU-40 y CU-41. Hay que actualizar su especificación en la documentación de la cátedra.

---

## Parte B: front desde cero

El front actual se borra entero, en una rama. El historial de git queda como referencia del contrato con la API.

### B0. Agente de diseño
`.claude/agents/disenador-ux.md` es un subagente dedicado solo a UX/UI, con skills de diseño precargadas. Arma con vos la identidad, los flujos y los wireframes, y deja todo en `docs/diseno/`. No toca el código de la app hasta que se apruebe el diseño.

### B1. Antes de escribir código
1. **Tareas por perfil**, pensadas desde cero y no desde los casos de uso:
   - **Admin:** qué necesita decidir hoy, preparar una salida y armar el catálogo.
   - **Cliente:** elegir un viaje, comprarlo y seguirlo.
   - **Guía:** ejecutar la salida, en el celular y sin señal.
2. **Flujos:** un diagrama por tarea, con el mínimo de pantallas.
3. **Dirección visual:** identidad propia de turismo andino, con paleta, tipografía, fotografía y tono de los textos.
4. **Wireframes** de las 6 pantallas clave, que se validan antes de implementar.

### B2. Flujos propuestos
- **Admin**
  - **"Hoy":** una bandeja con lo que requiere acción: salidas bajo el mínimo, propuestas de cierre, hoteles por confirmar, incidentes y faltantes.
  - **Salida:** una ficha con línea de tiempo (publicada → cerrada → en curso → finalizada). Cada paso muestra lo que ya está resuelto y lo que falta.
  - **Catálogo:** circuito → paquete (con costo y margen) → calendario de salidas.
  - **Recursos:** proveedores con un calendario de ocupación por recurso, que es donde se ve el historial.
  - **Personal:** un calendario de asignaciones.
- **Cliente:** destinos → paquete → fecha (en un calendario con cupos y "confirmada") → pasajeros → pago → "Mi viaje".
- **Guía:** pensado primero para el celular. "Mi próxima salida" → iniciar → avanzar etapa / incidente, con cola offline.

### B3. Implementación
- **Stack:** se mantiene React, Vite, TypeScript, Tailwind, react-query, react-hook-form y zod. El problema no fue la tecnología.
- **Sistema visual primero:** tokens en CSS, más 8 a 10 componentes base (botón, campo, tabla, ficha, estado, calendario, diálogo y aviso). Las pantallas usan solo esos componentes.
- **Límite de tamaño:** ninguna pantalla pasa de unas 300 líneas. Si crece, se parte.
- **Orden:** Admin, después Cliente, después Guía.
- **Pruebas:** Playwright por flujo. Caja negra se reescribe sobre la compra nueva.

---

## Orden de trabajo
1. A1, la ocupación por fechas. Es la base de todo lo demás.
2. A2 y A3, la asignación automática y el mínimo de pasajeros.
3. A4, costo y margen.
4. B1, en paralelo con A, porque no depende del código.
5. B3, cuando la API de A esté estable.

## Decisiones abiertas
1. ~~Stock por cantidad o por unidad~~ **Decidido:** por cantidad, con lo disponible calculado día por día.
2. ~~Sin stock de equipo al comprar~~ **Decidido:** se vende igual. El control va al crear la salida (A2b).
3. ~~Cierre bajo el mínimo~~ **Decidido:** se permite forzarlo con un motivo obligatorio, que queda en `RegistroAuditoria`.
4. ~~Componentes del front~~ **Decidido:** Radix para el diálogo, el menú, el select y las pestañas, y react-day-picker para el calendario.
5. ~~Casos de uso~~ **Decidido:** va al entregable del final. Se actualizan después, no ahora.
