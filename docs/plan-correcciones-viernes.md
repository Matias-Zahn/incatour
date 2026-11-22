# Plan: correcciones para el viernes 27/11

**Estado:** propuesta. No se toca código hasta que lo autorices.
**Objetivo:** vender la salida durante el mayor tiempo posible y que confirmarla deje de ser armarla a mano, que es donde hoy aparecen los errores.

## El problema de fondo
Hoy CU-40 hace dos cosas a la vez: asigna el guía, los porteadores y el equipo, y **corta la venta**, porque `asignacion.repository.ts:167` pone `estado: CERRADA` y `stockLocal: 0`. Así, cuanto antes se arma la logística, antes se deja de vender. Además todo se elige a mano y al final, que es cuando hay menos margen para corregir.

**El cambio:** cada recurso se resuelve en el momento en que ya se sabe lo que hace falta, y la venta termina sola en una fecha.

| Qué | Cuándo se resuelve | Cómo |
|---|---|---|
| Proveedores (hotel, transporte, tren y equipo) | Al crear el paquete | El paquete ya los guarda en `PaqueteServicio`. Al equipo se le suma la regla de cantidad |
| Hotel y transporte | Al crear la salida | Se ocupan completos, para `tamanoMaximo` |
| Guías y porteadores | Al crear la salida | Se eligen en el mismo asistente, con control de fechas |
| Equipo | En cada compra | Se descuenta por día, según los pasajeros vendidos |
| Fin de la venta | Solo, en una fecha | `fechaInicio − diasCierreVenta` |
| Confirmar la salida | Después del corte | Es una revisión: todo viene precargado |

---

## Bloque 1. Stock por día con historial (back)
Es el **plan A1** tal como está en `docs/plan-a1-ocupacion.md`: la tabla `Ocupacion`, `cantidadTotal` y `plazasTotales`, y se eliminan las 8 reposiciones manuales.
- **El historial de cada equipo** sale de la misma tabla, con `GET /api/servicios/:id/ocupacion?desde&hasta`.
- **En el front actual**, la ficha del servicio de Proveedores suma una tabla con día, ocupado, disponible y salida.

## Bloque 2. Que los servicios del paquete sirvan para algo
**Hoy:** el paquete pide elegir servicios, pero `PaqueteServicio` solo se usa para la lista "incluye" del catálogo (`catalogo.service.ts:41`) y para el transporte del cobro de equipaje (`reserva.service.ts:221`), que se elimina en el bloque 6. No interviene al crear la salida, ni al cerrarla, ni en el precio, y al cerrar la salida se vuelven a pedir los mismos recursos.

**Con el cambio, lo que se elige en el paquete es lo que usa la salida:**

| Tipo | En el paquete | Qué efecto tiene |
|---|---|---|
| Transporte | Uno, obligatorio | Se reserva al crear la salida (bloque 3) y suma su costo (bloque 5) |
| Tren | Uno, opcional | Suma su costo por pasajero (bloque 5) y aparece en "incluye" |
| Equipo | Varios, cada uno con su regla `cantidad` cada `cadaPasajeros` | Se descuenta en cada compra (bloque 4) y suma su costo (bloque 5) |
| Hotel | No se elige como servicio | Ya sale de la garantía del paquete (`GarantiaEstablecimiento`, o la localidad y la categoría). Lo que hace falta es que la garantía también sume su costo (bloque 5) |

- **"Sale desde" obligatorio (21/11):** `localidadGarantizada` pasa a ser obligatoria en los dos tipos de garantía.
  - En el formulario figura como "Sale desde", y en el catálogo como "Sale desde Cusco".
  - Con garantía por establecimiento, la lista de hoteles se filtra por esa localidad, y el back rechaza un hotel de otra.
  - **Migración:** los paquetes por establecimiento que no la tienen toman la localidad del primer hotel garantizado. Si sus hoteles están en localidades distintas, la migración los lista y se corrigen a mano.
- **El selector del paquete** pasa a tener un bloque por tipo, en lugar de una lista con todos los servicios mezclados. Solo se ofrecen los tipos de la tabla.
- **`PaqueteServicio` suma `cantidad` y `cadaPasajeros`**, que solo usa el equipo. Reemplaza al `RequerimientoEquipamiento` por circuito de A2, así que el proveedor y la regla quedan juntos.
- **Se congela en `definicionPaquete`**, como el resto, para que cambiar el paquete no altere las salidas ya creadas.
- **El cierre deja de pedirlos de nuevo:** la salida ya los trae (bloques 3 y 4).
- **Paquetes existentes:** la migración los deja como están. El equipo sin regla queda en 1 por pasajero, y un paquete sin transporte muestra un aviso en la lista de paquetes para completarlo.

## Bloque 3. Al crear la salida (CU-36)
- **Hotel y transporte:** se toman del paquete, con la opción de cambiarlos. Se ocupan para las fechas, con el control del 100 % de A2b.
- **Guías y porteadores:** se eligen en el mismo paso.
  - Se listan solo los libres en esas fechas, primero el que tiene menos salidas en el mes.
  - La cantidad de porteadores se sugiere según `tamanoMaximo` (los dos enteros de A2, en lugar de la regex de `parametrosPorteadores`).
  - Crea `AsignacionPersonal` como hoy, solo que antes.
- **Equipo:** se valida contra el stock proyectado, con la regla del 50 % de A2b, pero **todavía no se ocupa**.
- **El guía ve la salida desde que se crea.** Se revierte `guia.repository.ts:14`, que oculta las PUBLICADAS, porque ahora ya tienen guía.

## Bloque 4. Venta hasta el último momento
- **`Paquete.diasCierreVenta`** (entero, por defecto 2, congelado en la salida): cuántos días antes del inicio termina la venta.
- **Corte más largo con hotel a solicitud** (pedido de la profesora, 21/11): cuando el hotel de la salida es `A_SOLICITUD`, hay que gestionarlo con el hotel, así que el corte por defecto es de `DIAS_CIERRE_SOLICITUD = 5` días. Con bloqueo o convenio se mantienen los 2 días.
  - Se guarda en la salida como `Salida.diasCierreVenta`. Al crearla se propone `max(paquete.diasCierreVenta, hotel a solicitud ? 5 : 0)`, y el admin lo puede cambiar en el asistente.
  - Si la salida tiene varios hoteles (bloque 10), alcanza con que uno sea a solicitud para que rija el corte largo.
- **La venta se cierra por fecha, sin tarea programada.** `ventaAbierta(salida) = estado PUBLICADA && hoy < fechaInicio − salida.diasCierreVenta`. Es una función en `shared/` que usan el catálogo, la compra y el panel del admin.
- **El equipo se descuenta en cada compra (CU-30),** dentro de la misma transacción. La ocupación de cada equipo se **recalcula sobre el total vendido de la salida**: `ceil(vendidos / cadaPasajeros) × cantidad`, y se guarda el valor, no se suma ni se resta. Cancelar una reserva (CU-32) recalcula igual. Ver el bloque 12, punto 1.
  - **Sin stock al comprar:** se vende igual, ya decidido. Aparece la alerta `FALTA_RECURSO` en la salida.
- **CU-40 pasa a ser "Confirmar salida":**
  - Ya no asigna, porque todo llegó asignado. Muestra pasajeros, personal, hotel, transporte y equipo, y señala lo que falta.
  - Un botón confirma y pasa la salida a CERRADA.
  - Se puede confirmar recién después del corte de venta (decisión 4).
  - `FormularioAsignarRecursos` se achica a esa lista de control.
- **CU-39 (modificar logística)** queda para las excepciones: cambiar el guía, el hotel o el equipo de una salida ya creada.

## Bloque 5. Costo por pasajero al armar el paquete
Es la **fase 1 de A4**:
- **Mientras se eligen los servicios,** el formulario va sumando el costo por pasajero:
  - hotel: por plaza y por noche × noches. Si la garantía es por localidad y categoría, se toma el más caro de los que cumplen, para no vender a pérdida;
  - tren: por pasajero;
  - transporte: el costo de la salida ÷ `minimoPasajeros`, o ÷ `tamanoMaximo` si todavía no está el mínimo;
  - equipo: por unidad ÷ `cadaPasajeros`.
- **El precio:** el admin pone un margen en %, y la tarifa sugerida es `costo × (1 + margen)`. El precio lo sigue decidiendo él: si la tarifa queda por debajo del costo, se marca en rojo.
- **Back:** `costoPorPasajero(servicios, noches, pasajeros)` es una función pura con su test. Se expone en `POST /paquetes/costos/simular`, que usa el formulario.
- **Afuera por ahora:** el costo del personal y de los permisos (fase 3 de A4), y los tres escenarios de ganancia.

## Bloque 6. Sacar el cobro del equipaje
Ya está decidido (2026-11-15, en A2): quitar `equipaje` de `POST /reservas`, y `adicionalesEquipaje` de `calcularPrecio`, del desglose congelado, del paso de compra del front y de los casos de caja negra. Son unos 10 archivos, en el back y en el front.

## Bloque 7. Interfaz (front actual, sin rediseñar)
- **Asistentes por pasos** para los formularios largos: paquete, crear salida y circuito con etapas.
  - Un componente `Asistente` que muestra los pasos, con Atrás y Siguiente. Cada paso valida lo suyo con `trigger()` de react-hook-form, y el resumen va al final.
  - Los pasos de **crear salida**: paquete y fechas → hotel y transporte → guías y porteadores → revisión.
  - Los pasos del **paquete**: datos → servicios y equipo → noches y venta → precios con costo.
- **Modales en lugar del formulario que se abre arriba de la lista.** Ya existe `components/Modal.tsx`.
  - Los formularios cortos (proveedor, servicio, personal, cuenta de guía, temporada y etapa) se abren en el modal.
  - Los asistentes también, en un modal grande.
  - Al guardar se cierra y la lista se actualiza.
- **Fechas legibles:** ya existe `services/formato.ts`, con `formatearFechaUtcCorta` y `formatearRangoFechasUtc`. Hay que buscar las fechas que se muestran crudas (`2026-03-12T00:00:00.000Z` o `.slice(0, 10)`) y pasarlas por esas funciones. El formato queda como "12 mar 2026", y los rangos como "12–15 mar 2026".

## Bloque 8. Bug: plazas en un alojamiento a solicitud
- **Síntoma:** si se elige "a solicitud", el campo de plazas se oculta, pero sigue en el formulario. Si queda vacío, el guardado falla sin mostrar ningún error.
- **Causa:**
  - El campo usa `valueAsNumber`, que convierte el vacío en `NaN`. `z.number()` lo rechaza antes de llegar a la excepción de `superRefine` (`servicioService.ts:85`), y el error queda en un campo que no se ve.
  - Además, el back lo exige siempre (`servicio.dto.ts:53`, `vEntero(0)`), y la columna no admite null. El front lo tapa mandando un 0 (`FormularioServicio.tsx:110`).
- **Arreglo:**
  - **Front:** se cambia `valueAsNumber` por `setValueAs: v => v === "" ? undefined : Number(v)`. Sirve para todos los campos numéricos opcionales, no solo para este. Al pasar a "a solicitud" se limpia el valor con `setValue(..., undefined)`, y se borra el parche del 0.
  - **Back:** la capacidad es obligatoria solo con `BLOQUEO_PLAZAS`, y con "a solicitud" se rechaza si viene. La columna pasa a admitir null. Va en la misma migración de A1, donde la columna ya se renombra a `plazasTotales`.
  - **Test:** crear un alojamiento a solicitud sin plazas, en `servicio.dto.test.ts`.
- **Del mismo formulario:** `pesoEquipajeIncluido` y `costoPorKgExcedente` del transporte desaparecen con el bloque 6.

## Bloque 9. Revisión: cada elección tiene que tener efecto
Revisé cada campo que el admin elige en los formularios y dónde lo usa el back, sin contar el DTO ni la ruta.

**Sin efecto hoy, y ya cubiertos por otro bloque:**
| Campo | Dónde se elige | Qué hace hoy | Qué lo arregla |
|---|---|---|---|
| Servicios del paquete | Paquete | Solo la lista "incluye" | Bloque 2 |
| `costoBase` | Servicio | Nada | Bloque 5 |
| `nochesPrevias` y `nochesPosteriores` | Paquete | Solo se muestran en el catálogo. El bloqueo del hotel no las tiene en cuenta | Bloque 1 (A1) |
| `capacidadDisponible` a solicitud | Servicio | Se manda un 0 escondido | Bloque 8 |
| `pesoEquipajeIncluido` y `costoPorKgExcedente` | Servicio de transporte | El cobro de equipaje | Bloque 6 los elimina |

**Sin efecto hoy y sin un bloque que lo arregle (nuevos):**
- **Días habilitados del paquete (`diasDisponibles`):** solo se muestran en el catálogo, y se puede crear una salida un día no habilitado.
  - CU-36 rechaza una `fechaInicio` cuyo día de la semana no esté habilitado.
  - El selector de fecha del asistente deshabilita esos días.
- **Tren: horarios y días de operación:** se cargan, pero el back no los usa. Solo se ven en la lista de servicios.
  - Al crear una salida de un paquete con tren, se controla que el tren opere el día del inicio, con la misma función de días que el punto anterior.
  - Los horarios se muestran en "incluye" y en la ficha del guía.

**Tienen efecto (verificado):**
- **Circuito:** `minimoGuias` y los porteadores (dotación).
- **Paquete:** la garantía (hotel por localidad, categoría y tipo de habitación), `diasMinimosReintegro` (reintegro) y las tarifas por temporada (precio).
- **Servicio:** `capacidadVehiculo` (asignación), `modalidadConfirmacion` (bloqueo o solicitud) y, del proveedor, el canal y el contacto (solicitudes).
- **Personal:** el pasaporte, la nacionalidad y el vencimiento (permisos), y la habilitación del guía (asignación).
- **Informativos, que se muestran y está bien que solo eso:** la dificultad, las condiciones, la descripción y las etapas.
- **La moneda** ya quedó fija en USD.

**Fuera de la interfaz:** la tabla `Idioma` del personal no la usa ni el back ni el front. No se toca ahora.

## Bloque 10. Varios hoteles en una salida
La profesora preguntó si una salida puede tener más de un hotel, y la respuesta es sí: un hotel de convenio con 10 habitaciones no alcanza para una salida de 16.
- **Con A1 sale casi solo,** porque `Ocupacion` no tiene `@@unique` por salida. Se saca la validación de "un solo hotel" (A1, punto 1) y queda: la suma de plazas de los hoteles ≥ `tamanoMaximo`.
- **Crear salida (CU-36):** el paso de hotel permite agregar hoteles hasta cubrir el máximo, y muestra "Cubiertas 10 de 16 plazas".
- **Misma ciudad, sin lógica nueva:** la lista de hoteles de CU-36 ya se filtra por la garantía del paquete (`salida.repository.ts:85-94`), así que solo se pueden sumar hoteles que la cumplan.
  - Garantía por localidad y categoría: todos son de esa localidad y esa categoría.
  - Garantía por establecimiento: solo los de la lista, que ya están todos en la localidad de "Sale desde" (bloque 2).
- **Compra: el hotel se asigna en el momento.** Cada reserva va a un solo hotel, el primero con lugar para todo el grupo, empezando por los de bloqueo. Si le toca uno a solicitud, la solicitud de esa reserva va a ese hotel, como hoy. La confirmación ya no reparte nada. Ver el bloque 12, punto 2.
- `ponytail:` no se reparte por habitación ni por pasajero en la compra; se agrega si un hotel exige la lista de nombres antes.
- **Prioridad:** es lo primero que se posterga si no llega el viernes, porque con un hotel por salida el resto del plan funciona igual.

## Bloque 11. Textos y consistencia del admin (crítica impeccable, 21/11)
La crítica le dio 27/40 al admin actual. Para el viernes entra solo lo barato, que no compite con el back (decidido el 21/11):
- **Sacar la jerga de requisitos de la interfaz:**
  - "Advertencias operativas (RF-61)" (`SalidasPage.tsx:2023`) pasa a "Para resolver antes de salir".
  - Se saca "(RF-56)" (`:1876`).
  - "Consultar Salidas" (`:1329`) pasa a "Salidas".
  - Se sacan "(FA1)", "(FA2)" y "Perfil: ADMIN" de `FormularioCrearSalida.tsx` (`:242` y el paso 2).
  - "Bloq:", "(Esp: n)" y "Disp:" (`SalidasPage.tsx:738, 918, 869`) pasan a texto legible: "Etapa 1 de 3 esperada", "4 libres".
- **Valores internos y fechas:**
  - Los valores internos que se muestran tal cual pasan a texto en caso de oración. Por ejemplo, `CRITICO` y `BAJO` en el inicio, y `ACTIVO`, `ALOJAMIENTO`, `VIGENTE` y `VENCIDA` en proveedores y personal. Es la misma función `formatearEstado` del punto 15 del plan anterior.
  - Las fechas ISO de Personal (`PersonalPage.tsx:360, 390`) pasan por `formato.ts`, como dice el bloque 7.
- **Consistencia:**
  - "Dar de baja" usa el mismo estilo en todas las tablas: hoy es un botón rojo en Personal y un link en las demás.
  - Los botones repetidos en cada fila llevan `aria-label` con la salida o la persona, por ejemplo "Cancelar salida SAL-2026-001".
  - El paso del asistente muestra el total: "Paso 1 de 4".
- **Desborde a 1024 px:** el filtro y la tabla de Paquetes ensanchan la página. Se arregla con wrap en los filtros y con `min-w-0` en el contenedor.
- **Quedan para después del viernes:**
  - el inicio como bandeja "Hoy", en lugar de los 4 contadores;
  - la tabla de salidas con menos columnas, una acción por fila y su ficha propia;
  - el aviso de guía con habilitación vencida;
  - los íconos en lugar de emojis.

## Bloque 12. Ajustes de la revisión extra (21/11)
Son choques entre el plan y el código actual. Ninguno cambia la idea del plan: son controles que faltan o reglas que hay que ajustar.

1. **El equipo se calcula sobre el total de la salida, no por reserva.** Con "1 carpa cada 2", tres reservas de 1 pasajero suman 3 carpas por reserva, cuando alcanzan 2. Ya quedó corregido en el bloque 4.
2. **Cada reserva va a un hotel al comprar.** Hoy cada compra crea su propia solicitud al hotel (`reserva.repository.ts:173`). Con varios hoteles, el bloque 10 repartía a los pasajeros al confirmar, y entonces no se sabía a qué hotel iba cada solicitud. Ahora el hotel se asigna en la compra, y la solicitud sale para ese hotel.
   - `Reserva.idalojamiento`: lo completa la compra, dentro de la transacción que ya bloquea la salida.
   - `ponytail:` un grupo no se parte entre hoteles. Si ningún hotel le alcanza, la compra lo rechaza con "Quedan N lugares, pero no en un mismo hotel". Se parte si pasa seguido.
3. **El personal se vuelve a controlar.** Los controles de habilitación vigente, cuenta activa y pasaporte (`asignacion.service.ts:60-110`) pasan a una función que usan tanto crear salida como confirmar.
   - Se suma una alerta `PERSONAL_NO_APTO` en `resumirSalida`, que avisa apenas algo vence o alguien se da de baja, y no recién al confirmar.
4. **El transporte cuenta al personal.** La capacidad se compara contra `totalLugares` (pasajeros + guías + porteadores, ya calculado en `salida.service.ts:128`), no solo contra los pasajeros (`logistica.repository.ts:90, 262`).
5. **El precio queda fijo en la salida.** La compra hoy lee la tarifa vigente del paquete (`reserva.service.ts:210`), así que editar una tarifa cambia el precio de una salida que ya está a la venta, o la deja sin vender.
   - Al crear la salida, la tarifa de su temporada se congela en `definicionPaquete`, como el resto del paquete, y la compra la lee de ahí.
   - Si después cambian las tarifas del paquete, se aplican a las salidas nuevas. Cambiar el precio de una salida ya creada queda como excepción en modificar logística (CU-39), con motivo.
   - Las salidas viejas, sin la tarifa congelada, siguen leyendo la del paquete, como hoy.
6. **La salida no puede nacer con la venta cerrada.** CU-36 exige `fechaInicio > hoy + diasCierreVenta`, no solo una fecha futura (`salida.service.ts:105`). El calendario del asistente desactiva esos días. Comparte el control con los días habilitados del bloque 9.
7. **El cliente ve si su compra ya no tiene reintegro.** Si `hoy > fechaInicio − diasMinimosReintegro`, la ficha y el pago dicen "Esta fecha ya no tiene reintegro si cancelás", antes de pagar. Es solo texto en el front, porque el dato ya viene en la salida.
8. **Personal explica por qué alguien está bloqueado.** Cuando la baja o el cambio de pasaporte se rechazan por salidas asignadas (`personal.service.ts:37-49`), el mensaje lista esas salidas y ofrece "Reemplazar en la salida", que ya existe (CU-38).

**Impacto en el calendario:** suma cerca de un día de back, que se reparte entre el martes y el miércoles. Si no entra, se posterga el bloque 10 (varios hoteles), y con él el punto 2.

---

## Implementación entre dos personas
El trabajo se reparte por capa, así cada uno toca sus propios archivos.
- **A · back:** el back de los bloques 1, 2, 3, 4, 9 y 10, casi todo el bloque 12, y la migración entera. Sus archivos son `schema.prisma`, las migraciones, los módulos `ocupacion`, `salida`, `reserva`, `asignacion` y `paquete`, y `scripts/demo.ts`.
- **B · front:** los bloques 5, 6, 7 y 11 enteros, y el front de los bloques 1, 2, 3, 4, 8, 9, 10 y 12. Sus archivos son `frontend/src`, los mocks de MSW, `costoPorPasajero` (en un archivo nuevo) y la caja negra.

### Quién hace qué en cada bloque
| Bloque | A · back | B · front |
|---|---|---|
| 1 · Stock por día | `Ocupacion` y los totales, sacar las 8 reposiciones, `GET /servicios/:id/ocupacion` | La tabla del historial en la ficha del servicio |
| 2 · Servicios del paquete | `cantidad`/`cadaPasajeros` en `PaqueteServicio`, "Sale desde" obligatorio con la carga de los paquetes existentes, copia del paquete en la salida, cierre sin pedir recursos, aviso sin transporte | Selector por tipo, regla de cada equipo, campo "Sale desde" y su muestra en el catálogo, aviso en la lista |
| 3 · Al crear la salida | Reservar hotel y transporte, personal libre ordenado por salidas del mes, control del equipo al 50 %, el guía ve la salida desde que se crea | Pasos de hotel y transporte y de guías y porteadores, con sus avisos |
| 4 · Venta hasta el final | `diasCierreVenta`, corte de 5 días a solicitud, `ventaAbierta`, compra que recalcula el equipo, `FALTA_RECURSO`, CU-40 "Confirmar salida" | Campo del corte, pantalla de confirmación con su botón después del corte, etiqueta de la alerta, "venta cerrada" en el catálogo |
| 5 · Costo por pasajero | — | `costoPorPasajero` con su test y `POST /paquetes/costos/simular`, costo en vivo, margen y rojo bajo costo |
| 6 · Sin equipaje | Borrar las columnas en la migración | `POST /reservas`, el precio, el desglose, el paso de compra y la caja negra |
| 7 · Interfaz | — | Asistentes, modales y fechas |
| 8 · Bug de plazas | DTO con plazas obligatorias solo con bloqueo, columna que admite vacío | Campo vacío como "sin dato", limpiarlo en "a solicitud", sacar el 0, la prueba |
| 9 · Elecciones con efecto | Rechazar días no habilitados, controlar el día del tren | Días desactivados en el calendario, horarios del tren en "incluye" y en la ficha del guía |
| 10 · Varios hoteles | Suma de plazas, hotel asignado al comprar (`Reserva.idalojamiento`), corte de 5 días si alguno es a solicitud | Sumar hoteles en el asistente, "Cubiertas 10 de 16 plazas" |
| 11 · Textos del admin | — | Todo |
| 12 · Revisión extra | Puntos 1 a 5, la fecha mínima del 6 y la lista de salidas del mensaje del 8 | Calendario del 6, aviso de reintegro del 7, botón de reemplazar del 8 y etiqueta de la alerta del 3 |

### Reglas para no pisarse
1. **Un solo dueño de la base:** solo A toca `schema.prisma`. Si B necesita una columna, se la pide.
2. **Contrato primero:** el sábado A escribe en `docs/contratos-viernes.md` los endpoints y tipos nuevos (ocupación, salida con personal, confirmación, alertas, costo). B arma el front contra esos tipos con MSW.
3. **`reserva.service.ts` por turno:** B saca el equipaje y lo mergea el lunes, y A cambia la compra recién el martes.
4. **PRs chicos, mergeados a la mañana:** cada uno actualiza su rama desde `main` todos los días.
5. **Antes de arrancar:** mergear `fix/topes-campos-numericos`.

### Día por día
| Día | A · back | B · front |
|---|---|---|
| Sáb 21 – Dom 22 | El contrato, la migración entera (con el equipaje y las plazas del bloque 8) y el bloque 1, probados en `incatour_demo_prueba` | El bloque 6, el front del bloque 8 y las fechas del bloque 7 |
| Lun 23 | El back del bloque 2, el "Sale desde", `ventaAbierta` y el bloque 9 | Los textos del bloque 11 y `costoPorPasajero` con su test y su endpoint |
| Mar 24 | El back de los bloques 3 y 4, más los puntos 1, 3, 4 y 6 del bloque 12 | El asistente y los modales, con el paquete por secciones y el costo en vivo |
| Mié 25 | El punto 5 del bloque 12 y el bloque 10 | El asistente de crear salida con personal y la pantalla de confirmación, contra mocks |
| Jue 26 | `demo.ts` (con el cambio sin guardar), la integral y el humo, y ayudar a conectar el front | Del mock al back real, el historial, los varios hoteles y los puntos 7 y 8 del bloque 12 |
| Vie 27 | Juntos: demo nueva y prueba a mano de punta a punta, cada uno en el rol del otro. B corre la caja negra y A corrige el back | |

### PRs, en orden de merge
| Rama | De | Contiene | Merge |
|---|---|---|---|
| `feat/sin-equipaje` | B | Bloque 6 y el front del bloque 8 | Lun |
| `feat/stock-por-dia` | A | La migración y el bloque 1 | Lun |
| `feat/textos-admin` | B | Bloque 11 y las fechas | Mar |
| `feat/venta-continua` | A | El back de los bloques 2, 3, 4, 9, 10 y 12 | Jue |
| `feat/asistentes` | B | El bloque 5, los asistentes y el front de los bloques 2, 3, 4, 10 y 12 | Jue, después del de A |

- **Si no llega:** primero se posterga el bloque 10 (con el punto 2 del bloque 12), después el historial y los modales de los formularios cortos. La venta continua y la asignación al crear la salida no se postergan.
- **Si uno se traba:** A toma el back del bloque 5, o B toma la pantalla del historial.
- **Bases:** cada uno trabaja con su propia copia de `incatour_demo`. `incatour_db` se toca solo con autorización.

## Decisiones (2026-11-21)
1. **CERRADA** significa "confirmada por el admin". El fin de la venta se calcula por fecha, sin un estado nuevo.
2. **`diasCierreVenta`** vale 2 por defecto.
3. **El permiso de ingreso** se tramita solo por la API, así que no necesita un corte distinto.
4. **Confirmar antes del corte:** no se puede. El botón Confirmar aparece cuando termina la venta. Una salida llena deja de venderse sola, porque no le quedan lugares.
5. **Porteadores:** se fijan con `tamanoMaximo` al crear la salida, y la confirmación avisa si sobran.
6. **Hotel a solicitud:** su corte de venta es más largo, 5 días por defecto.
7. **Varios hoteles por salida:** sí (bloque 10).

## Devolución de la profesora (audio del 21/11)
Coincide con el plan: asignar los recursos al planificar la salida, no cortar la venta antes de tiempo, sacar el equipaje de la compra y arreglar el campo del tipo de habitación. Las fechas son un detalle visual. La cuenta de permisos de pasajeros más personal está bien. Mencionó que faltaba corregir algo de las pruebas; el manual ya estaba.
