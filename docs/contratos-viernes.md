# Contratos de API para el viernes 27/11

**Para qué:** que B arme el front contra MSW sin esperar al back, y que A sepa qué tiene que devolver. Sale de `docs/plan-correcciones-viernes.md` (los bloques se citan como **B1** a **B12**, y los puntos del bloque 12 como **12.1** a **12.8**) y de `docs/plan-a1-ocupacion.md`.

**Estado:** aprobado por A el 21/11. Lo marcado **Decidido:** no venía en el plan y A lo aceptó; el resto sale del plan tal cual. Si algo cambia en la implementación, A actualiza este documento y avisa.

**Leyenda de los tipos:** `// NUEVO`, `// CAMBIA` y `// SE ELIMINA` se comparan con el código de hoy (rama `feat/stock-por-dia`, 21/11), y en cada sección se cita el archivo actual.

---

## 0. Convenciones (las de hoy, salvo lo marcado)

- **Respuesta OK:** `{ data: T }`, o `{ mensaje: string; data: T }` en las altas y en las acciones. Cada sección dice cuál.
- **Error:** `{ error: string }` con el código HTTP (`backend/src/error/manejadorErrores.ts:30`). El front lo lee en `clienteApi.ts:86` y lo lanza como `ErrorApi(estado, mensaje)`.
- **Error con datos** (para 12.8 y el equipo de A2b). **Decidido:**
  ```ts
  type ErrorConDetalle<T> = { error: string; detalle: T }; // NUEVO
  ```
  - **Back:** `CustomError` suma un tercer parámetro opcional, `detalle`, y `manejadorErrores` lo copia al cuerpo.
  - **Front:** `ErrorApi` suma `detalle?: unknown`, que se lee del cuerpo en `clienteApi.ts:86`. Es el único cambio en `clienteApi.ts`.
- **Fechas:** los `DateTime` de Prisma siguen viniendo como ISO (`"2026-03-12T00:00:00.000Z"`). **Decidido:** los campos de fecha calculados que son nuevos (`ultimoDiaVenta`, `fechaLimiteReintegro`, `fechaMinima`, `dias[].fecha`) vienen como `"AAAA-MM-DD"`. El front los formatea con `services/formato.ts` (B7).
- **Fechas en los mensajes de error:** `DD/MM/AAAA`, como el ejemplo de A1 ("el 12/03"). **Propuesta.**
- **Roles:** `ADMIN` y `CLIENTE` salen de `requierePerfil(...)`, y "público" quiere decir sin token.
- **Días de la semana:** los códigos `L M X J V S D`, unidos con guion (`"L-X-V"`), como hoy en `paquete.dto.ts:191` y `servicio.dto.ts:33`.

### Constantes que el front tiene que conocer
| Nombre | Valor | Dónde vive (back) | Bloque |
|---|---|---|---|
| `DIAS_CIERRE_VENTA_DEFECTO` | 2 | `shared/constantes.ts` | B4, decisión 2 |
| `DIAS_CIERRE_SOLICITUD` | 5 | `shared/constantes.ts` | B4 |
| `DIAS_REACONDICIONAMIENTO` | 2 | `shared/constantes.ts` | A1 §2 |
| `COBERTURA_MINIMA_STOCK` | 0.5 | `shared/constantes.ts` | B3, A2b |

---

## 1. Ocupación de un servicio (historial) — B1

`GET /api/servicios/:idservicio/ocupacion?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` · **ADMIN** · solo lectura.
La forma ya está fijada en `plan-a1-ocupacion.md` §3. Este endpoint es nuevo y hoy no tiene nada parecido.

```ts
type RespuestaOcupacion = { data: OcupacionServicio };

type OcupacionServicio = {
  total: number | null;          // cantidadTotal (equipo), plazasTotales (hotel), 1 (transporte). null: hotel a solicitud
  dias: {
    fecha: string;               // "AAAA-MM-DD", uno por día del rango, sin huecos
    ocupado: number;             // suma de las ocupaciones de salidas activas que cubren ese día
    disponible: number | null;   // total − ocupado (puede ser negativo si falta, ver FALTA_RECURSO). null si total es null
  }[];
  ocupaciones: {
    nroSalida: string;
    desde: string;               // "AAAA-MM-DD"
    hasta: string;               // "AAAA-MM-DD", inclusive
    cantidad: number;
    estadoSalida: "PUBLICADA" | "CERRADA" | "EN_CURSO" | "FINALIZADA";
  }[];                           // incluye las FINALIZADAS (historial), aunque no ocupen
};
```

- **Decidido:** sin `desde`, toma hoy; sin `hasta`, toma `desde + 30 días`. El rango máximo es de 366 días.
- **Decidido:** `ocupaciones` suma `idsalida: number`, para que la fila lleve a la salida. Es opcional en el mock.
- **Decidido:** `disponible` puede ser negativo. Así la tabla muestra el faltante tal cual, sin esconderlo.

| Código | Mensaje |
|---|---|
| 400 | `El id del servicio debe ser un entero positivo` |
| 400 | `desde debe ser una fecha válida (AAAA-MM-DD)` (y lo mismo para `hasta`) |
| 400 | `desde no puede ser posterior a hasta` |
| 400 | `El rango no puede superar los 366 días` |
| 400 | `El tren no lleva ocupación por fechas` (**Propuesta**) |
| 404 | `No se encontró el servicio con ID 7.` (mismo texto que `servicio.service.ts:191`) |

**Ficha del servicio** (`GET /api/servicios/:id`, `servicio.service.ts:205`): según A1 §3 mantiene los nombres. En equipo, `disponibilidad.cantidadDisponible` pasa a querer decir "disponible hoy", y `inventarioTotal` es `cantidadTotal`. Al editar se suma este error (A1 §3):

| Código | Mensaje |
|---|---|
| 400 | `Hay 28 carpas comprometidas el 12/03/2026: el total no puede quedar por debajo` |

---

## 2. Alojamiento a solicitud sin plazas — B8

`POST /api/proveedores/:idproveedor/servicios` y `PUT /api/servicios/:id` · **ADMIN**. Hoy: `servicio.dto.ts:53` (`capacidadDisponible: vEntero(0, …)`, obligatorio siempre).

```ts
type CamposAlojamiento = {
  tipo: "ALOJAMIENTO";
  categoria: string;
  tipoHabitacion: string;
  modalidadConfirmacion: "BLOQUEO_PLAZAS" | "A_SOLICITUD";
  capacidadDisponible?: number;  // CAMBIA: obligatoria solo con BLOQUEO_PLAZAS (1..5000); con A_SOLICITUD no se manda
};

// Respuesta (servicio.service.ts:218)
type DisponibilidadAlojamiento = {
  capacidadDisponible: number | null; // CAMBIA: null con A_SOLICITUD
  modalidadConfirmacion: string;
};
```

- **El nombre del campo se mantiene:** el body sigue usando `capacidadDisponible`, aunque la columna pasa a `plazasTotales` (A1 §1). Así queda en A1, respuesta 3.
- **Decidido:** un `PUT` que pasa a `A_SOLICITUD` pone la columna en null, y el front no manda el campo. Un `PUT` que pasa a `BLOQUEO_PLAZAS` desde a solicitud tiene que traer `capacidadDisponible`.
- **Transporte (B6):** `pesoEquipajeIncluido` y `costoPorKgExcedente` **SE ELIMINAN** del body y de la respuesta. Si vienen, se ignoran (**Propuesta**).

| Código | Mensaje |
|---|---|
| 400 | `capacidadDisponible es requerido con BLOQUEO_PLAZAS.` |
| 400 | `capacidadDisponible no corresponde a un alojamiento a solicitud: el hotel confirma cada pedido.` |
| 400 | `capacidadDisponible debe ser un número entero mayor o igual a 1.` (hoy el mínimo es 0) |

---

## 3. Paquete: "Sale desde", servicios por tipo, equipo y corte — B2, B4, B9

`POST /api/paquetes`, `PUT /api/paquetes/:id`, `GET /api/paquetes`, `GET /api/paquetes/:id` · **ADMIN**. Hoy: `paquete.dto.ts`, `paquete.repository.ts:43`, y en el front `paqueteService.ts:127` (`Paquete`) y `:174` (`DatosCrearPaquete`).

### 3.1 Body de alta
```ts
type DatosCrearPaquete = {
  idcircuito: number;
  nombrePaquete: string;
  condiciones?: string;
  tipoGarantia: "POR_ESTABLECIMIENTO" | "POR_CATEGORIA";
  localidadGarantizada: string;        // CAMBIA: obligatoria en los dos tipos ("Sale desde")
  idservicioGarantizado?: number;      // solo por establecimiento; tiene que estar en localidadGarantizada
  categoriaGarantizada?: string;       // solo por categoría
  tipoHabitacionGarantizada?: string;  // solo por categoría
  nochesPrevias: number;
  nochesPosteriores: number;
  diasDisponibles?: string;            // "L-X-V"
  diasMinimosReintegro?: number | null;
  diasCierreVenta?: number;            // NUEVO: 0..30, por defecto 2
  idtransporte: number;                // NUEVO: obligatorio, un servicio TRANSPORTE activo
  idtren?: number | null;              // NUEVO: opcional, un servicio TREN activo
  equipo?: {                           // NUEVO: servicios EQUIPAMIENTO con su regla
    idservicio: number;
    cantidad: number;                  // 1..100
    cadaPasajeros: number;             // 1..100. "1 carpa cada 2" = { cantidad: 1, cadaPasajeros: 2 }
  }[];
  matrizPrecios: { idtemporada: number; monto: number; moneda: "USD" }[];
  serviciosIncluidos?: number[];       // SE ELIMINA: lo reemplazan idtransporte, idtren y equipo
};
```
- **Propuesta (forma del body):** van tres campos por tipo y no una lista mixta, porque así el DTO valida "uno obligatorio" sin mirar la base. En la base sigue todo en `PaqueteServicio` (B2).
- **Decidido:** si llega `serviciosIncluidos`, el back responde 400 para que un front viejo no pierda datos en silencio.
- **El hotel no se elige como servicio** (B2): sale de la garantía.
- **`PUT`:** los mismos campos, todos opcionales. Si viene `idtransporte`, `idtren` o `equipo`, se reemplaza **ese tipo entero**. `idtren: null` quita el tren.

### 3.2 Respuesta (`GET /:id`, `POST`, `PUT`)
```ts
type Paquete = {
  // ...todos los campos de hoy (paqueteService.ts:127)
  localidadGarantizada: string;          // CAMBIA: ya no es null
  diasCierreVenta: number;               // NUEVO
  servicios: {                           // CAMBIA: suma tipo, cantidad, cadaPasajeros y el tren
    idpaquete: number;
    idservicio: number;
    tipo: "TRANSPORTE" | "TREN" | "EQUIPAMIENTO";  // NUEVO
    cantidad: number | null;             // NUEVO: solo EQUIPAMIENTO
    cadaPasajeros: number | null;        // NUEVO: solo EQUIPAMIENTO
    servicio: {
      idservicio: number;
      nombreServicio: string;
      localidad: string;
      costoBase: number;
      tren?: { horarioSalida: string; horarioLlegada: string; diasOperacion: string } | null; // NUEVO
      equipamiento?: { tipoEquipamiento: string } | null;                                 // NUEVO
    };
  }[];
  faltaTransporte: boolean;              // NUEVO (B2): paquete viejo sin transporte; también en GET /paquetes
  calendarioSalidas: {                   // NUEVO (B9, 12.6), solo en GET /:id. Propuesta
    diasHabilitados: ("L"|"M"|"X"|"J"|"V"|"S"|"D")[]; // diasDisponibles ∩ diasOperacion del tren
    fechaMinima: string;                 // "AAAA-MM-DD" = hoy + diasCierreVenta + 1
  };
};
```
- **`GET /api/paquetes`** (lista): suma `faltaTransporte` y `diasCierreVenta`. El resto queda igual (`paquete.repository.ts:31`).
- **`calendarioSalidas`** es lo que usa el paso 1 del asistente de crear salida para desactivar días (B9, 12.6). **Decidido:** sale del back y no se recalcula en el front, para que las dos reglas vivan en un solo lugar. `fechaMinima` usa el corte del paquete. Si después se elige un hotel a solicitud, el corte pasa a 5 días y lo controla `POST /salidas` (sección 5.3).

### 3.3 Errores nuevos
| Código | Mensaje | Bloque |
|---|---|---|
| 400 | `localidadGarantizada (Sale desde) es obligatoria.` | B2 |
| 400 | `El hotel garantizado está en Aguas Calientes y el paquete sale desde Cusco.` | B2 |
| 400 | `idtransporte es requerido y debe ser un número entero mayor a 0.` | B2 |
| 400 | `El servicio con ID 12 no es un transporte.` (lo mismo para tren y equipamiento) | B2 |
| 400 | `El servicio con ID 12 no existe o no está activo.` (el texto de hoy, `paquete.service.ts:281`) | B2 |
| 400 | `equipo[1]: cantidad y cadaPasajeros deben ser enteros entre 1 y 100.` | B2 |
| 400 | `equipo repite el servicio 7.` | B2 |
| 400 | `diasCierreVenta debe ser un número entero entre 0 y 30.` | B4 |
| 400 | `serviciosIncluidos ya no se usa: mandá idtransporte, idtren y equipo.` (**Propuesta**) | B2 |

---

## 4. Costo por pasajero — B5

`POST /api/paquetes/costos/simular` · **ADMIN** · no guarda nada. Es nuevo. Según el plan lo hace B: `costoPorPasajero` en un archivo nuevo, con su test, más la ruta. Lo usa el paso "precios con costo" del asistente de paquete.

```ts
type SimularCostoBody = {
  tipoGarantia: "POR_ESTABLECIMIENTO" | "POR_CATEGORIA";
  idservicioGarantizado?: number;
  localidadGarantizada: string;
  categoriaGarantizada?: string;
  tipoHabitacionGarantizada?: string;
  nochesPrevias: number;
  nochesPosteriores: number;
  idtransporte?: number;
  idtren?: number;
  equipo?: { idservicio: number; cantidad: number; cadaPasajeros: number }[];
  pasajeros: number;  // divisor del transporte: minimoPasajeros, o tamanoMaximo mientras no exista (B5). 1..100
};

type RespuestaSimularCosto = {
  data: {
    costoPorPasajero: number;   // redondeado a 2 decimales, USD
    moneda: "USD";
    desglose: {
      tipo: "ALOJAMIENTO" | "TRANSPORTE" | "TREN" | "EQUIPAMIENTO";
      idservicio: number | null;  // null si no hubo hotel candidato
      nombreServicio: string;
      costoBase: number;
      calculo: string;            // "45 × 3 noches", "600 ÷ 12 pasajeros", "80 × 1 ÷ 2"
      porPasajero: number;
    }[];
    avisos: string[];             // p. ej. "Ningún hotel de Cusco cumple 3 Estrellas · Doble: el costo no incluye el hotel"
  };
};
```
- **Reglas (B5):**
  - hotel: `costoBase × (nochesPrevias + nochesPosteriores)`. Por categoría, se toma el **más caro** de los que cumplen.
  - tren: `costoBase`.
  - transporte: `costoBase ÷ pasajeros`.
  - equipo: `costoBase × cantidad ÷ cadaPasajeros`.
- **Decidido:** el margen y la tarifa sugerida (`costo × (1 + margen)`) se calculan en el front, porque son una cuenta sobre `costoPorPasajero`. El rojo bajo costo también va en el front.

| Código | Mensaje |
|---|---|
| 400 | `pasajeros es requerido y debe ser un número entero entre 1 y 100.` |
| 400 | `El servicio con ID 12 no es un transporte.` (lo mismo para los otros tipos) |
| 400 | `El servicio con ID 12 no existe o no está activo.` |
| 400 | `nochesPrevias debe ser un número entero entre 0 y 30.` (los mismos textos de `paquete.dto.ts`) |

---

## 5. Crear salida (CU-36) — B3, B4, B9, B10, 12.4, 12.5, 12.6

Hoy: `salida.dto.ts:59` (`CrearSalidaDto`), `salida.service.ts:24` (opciones) y `:46` (alta). En el front: `salidaService.ts:123-190`.

### 5.1 Opciones del asistente
`GET /api/salidas/opciones?idpaquete=&fechaInicio=AAAA-MM-DD&tamanoMaximo=` · **ADMIN**. Los parámetros son los mismos de hoy.

**Decidido:** el personal libre, los transportes, el equipo y el tren entran en esta misma respuesta, y no en endpoints nuevos, porque necesitan los mismos tres datos y las mismas validaciones (`prepararSalida`).

```ts
type OpcionesSalidaDto = {
  paquete: {
    idpaquete: number;
    nombrePaquete: string;
    idtransporte: number | null;       // NUEVO: el del paquete, preseleccionado
    diasCierreVenta: number;           // NUEVO
  };
  fechaFin: string;                    // NUEVO: "AAAA-MM-DD"
  tamanoMaximo: number;
  dotacion: { guias: number; porteadores: number };  // porteadores ahora con los dos enteros de A2
  totalLugares: number;                // tamanoMaximo + dotación (12.4: es lo que tiene que entrar en el vehículo)
  cupoAutoridad: { lugaresDisponibles: number; alcanza: boolean } | null;
  tarifa: { idtemporada: number; temporada: string; monto: number; moneda: "USD" }; // NUEVO (12.5): la que se congela

  plazasNecesarias: number;            // NUEVO: tamanoMaximo, o 0 si el paquete no tiene noches de hotel
  alojamientos: {
    idservicio: number;
    nombreServicio: string;
    localidad: string;
    categoria: string | null;
    modalidadConfirmacion: "BLOQUEO_PLAZAS" | "A_SOLICITUD"; // NUEVO: ahora se listan los dos
    capacidadDisponible: number | null; // CAMBIA: libre en las noches de esta salida (A1). null a solicitud
    alcanza: boolean;                   // solo, cubre plazasNecesarias (a solicitud: siempre true)
  }[];

  transportes: {                       // NUEVO (B3): los TRANSPORTE activos
    idservicio: number;
    nombreServicio: string;
    capacidadVehiculo: number;
    delPaquete: boolean;
    libre: boolean;                    // sin otra salida activa en esas fechas
    alcanza: boolean;                  // capacidadVehiculo >= totalLugares (12.4)
  }[];

  personal: {                          // NUEVO (B3): solo los aptos y libres en esas fechas
    guias: PersonalLibre[];            // ordenados por salidasEnElMes y después por nombre
    porteadores: PersonalLibre[];
  };

  equipo: {                            // NUEVO (B3, A2b): el del paquete, controlado pero sin ocupar
    idservicio: number;
    nombreServicio: string;
    tipoEquipamiento: string;
    cantidad: number;
    cadaPasajeros: number;
    necesitaCompleta: number;          // ceil(tamanoMaximo / cadaPasajeros) × cantidad
    libre: number;                     // el mínimo diario de libre en el rango, descontada la demanda proyectada de las otras salidas
    fechaCritica: string | null;       // "AAAA-MM-DD" del día con menos libre
    nivel: "OK" | "RIESGO" | "NO_ALCANZA"; // >= 100 %, entre 50 y 100 %, < 50 %
  }[];

  tren: {                              // NUEVO (B9)
    idservicio: number;
    nombreServicio: string;
    horarioSalida: string;
    horarioLlegada: string;
    diasOperacion: string;
    operaEseDia: boolean;
  } | null;
};

type PersonalLibre = {
  idpersonal: number;
  nombreCompleto: string;
  rol: "Guía" | "Porteador";
  salidasEnElMes: number;              // Propuesta: salidas no canceladas que empiezan en el mismo mes que esta
};
```
- **"Apto"** quiere decir: activo; si es guía, con la habilitación vigente hasta `fechaFin` y la cuenta activa; y con el pasaporte que vence después de `fechaFin`. Es la función compartida de 12.3. **Decidido:** los que no son aptos no se listan.
- **Corte sugerido (B4):** el front lo calcula como `max(paquete.diasCierreVenta, algún hotel elegido es A_SOLICITUD ? 5 : 0)` y lo muestra editable. **Decidido:** se calcula en el front porque depende de los hoteles que se van eligiendo.
- **"Cubiertas 10 de 16 plazas" (B10):** es la suma de `capacidadDisponible` de los hoteles elegidos con bloqueo. **Decidido:** un hotel a solicitud cubre lo que falte, porque no tiene tope.

Errores (además de los de hoy, en `salida.dto.ts` y `salida.service.ts:105-130`):

| Código | Mensaje | Bloque |
|---|---|---|
| 400 | `La salida tiene que empezar después del 23/11/2026: la venta cierra 2 días antes del inicio` (reemplaza `La fecha de inicio tiene que ser futura`) | 12.6 |
| 400 | `El paquete no sale los martes: los días habilitados son L, X y V` | B9 |
| 400 | `El tren Inca Rail Expedition no opera los martes (opera L-X-V)` | B9 |

**Decidido:** las opciones también aplican estos tres controles, así el asistente se frena en el paso 1 y no al final.

### 5.2 Alta
`POST /api/salidas` · **ADMIN**.

```ts
type DatosCrearSalida = {
  idpaquete: number;
  fechaInicio: string;        // "AAAA-MM-DD"
  tamanoMaximo: number;
  alojamientos: number[];     // NUEVO (B10): uno o más; vacío solo si plazasNecesarias es 0
  idtransporte: number;       // NUEVO (B3)
  personalIds: number[];      // NUEVO (B3): guías y porteadores
  diasCierreVenta?: number;   // NUEVO (B4): 0..30; sin él, rige el sugerido
  idalojamiento?: number;     // SE ELIMINA: lo reemplaza alojamientos
};

type RespuestaCrearSalida = {
  mensaje: "Salida creada y publicada exitosamente";
  data: {
    salida: SalidaApi;        // la misma forma del listado (sección 6)
    dotacion: { guias: number; porteadores: number };
    totalLugares: number;     // CAMBIA: tamanoMaximo + personal elegido (es lo que se bloquea ante la autoridad)
    advertencias: string[];   // NUEVO: el equipo en RIESGO, p. ej. "Si se vende completa faltarían hasta 3 carpas el 12/03/2026"
  };
};
```
- **Personal (decisión 5):** tiene que cubrir **al menos** la dotación por `tamanoMaximo`. **Decidido:** se aceptan extras, y el cupo ante la autoridad se pide por `tamanoMaximo + personalIds.length`.
- **Qué queda al crear:** el hotel y el transporte quedan ocupados (`Ocupacion`), el personal en `AsignacionPersonal`, y la tarifa de la temporada y el equipo con su regla congelados en `definicionPaquete` (12.5, B2). El equipo **no** se ocupa todavía.

### 5.3 Errores del alta
Valen todos los de 5.1, más estos:

| Código | Mensaje | Bloque |
|---|---|---|
| 400 | `alojamientos debe ser una lista de ids de servicio` / `idtransporte es requerido y debe ser un entero positivo` / `personalIds debe ser una lista de ids de personal` | B3, B10 |
| 400 | `La salida tiene que empezar después del 21/11/2026: la venta cierra 5 días antes del inicio` (se vuelve a controlar con el corte final) | 12.6, B4 |
| 400 | `El hotel Tierra Viva no cumple la garantía del paquete` | B10 |
| 400 | `Los hoteles elegidos cubren 10 de 16 plazas en esas noches` | B10 |
| 400 | `Elegí al menos un hotel` | B10 |
| 400 | `El transporte elegido tiene 12 asientos y la salida necesita 20 lugares (16 pasajeros y 4 del personal)` | 12.4 |
| 400 | `La salida necesita al menos 1 guías y 8 porteadores (elegiste 1 y 6)` (el texto de hoy, `asignacion.service.ts:78`) | B3 |
| 400 | `Juan Pérez: la habilitación vence el 10/03/2026`, uno por persona no apta, unidos con ". " (**cambia en la etapa 3**: un solo formato, el de `avisos`; los motivos son `está dado de baja`, `no tiene la habilitación cargada`, `la habilitación vence el …`, `no tiene una cuenta de usuario activa para reportar avances` y `el pasaporte vence el …`) | 12.3 |
| 400 | `El transporte elegido no existe o no está activo` (**nuevo en la etapa 3**) | B3 |
| 409 | `El hotel Tierra Viva ya no tiene plazas suficientes en esas noches. Volvé a cargar las opciones` | B3 |
| 409 | `El transporte elegido ya está ocupado en esas fechas. Volvé a cargar las opciones` | B3 |
| 409 | `Parte del personal elegido se asignó a otra salida en esas fechas. Volvé a cargar las opciones` (el texto de hoy, `asignacion.repository.ts:104`) | B3 |
| 409 | `No alcanza el equipo: el 12/03/2026 hay 3 libres de Carpa doble 4 estaciones y la salida necesita al menos 4 (8 si se vende completa). Probá con un máximo de 6 pasajeros`, con `detalle` (abajo). Con varios equipos, los textos van separados por "; ". Sin máximo posible, sin la última oración | B3, A2b |
| 503 | `No fue posible comunicarse con el servicio de la autoridad. Reintentá más tarde` (el de hoy) | — |

```ts
// detalle del 409 de equipo. Propuesta (ver la sección 0)
type DetalleFaltaEquipo = {
  faltantes: { idservicio: number; nombreServicio: string; fecha: string; libre: number; necesitaMinimo: number }[];
  tamanoMaximoSugerido: number;
};
```

---

## 6. Listado de salidas del admin: venta y alertas — B4, 12.3

`GET /api/salidas` · **ADMIN** · los filtros son los de hoy. Hoy: `salida.service.ts:152` (`resumirSalida`) y en el front `salidaService.ts:56` (`SalidaApi`).

```ts
type SalidaApi = {
  // ...todos los campos de hoy
  diasCierreVenta: number;          // NUEVO
  ultimoDiaVenta: string;           // NUEVO: "AAAA-MM-DD" = fechaInicio − diasCierreVenta − 1
  ventaAbierta: boolean;            // NUEVO: estado PUBLICADA && hoy <= ultimoDiaVenta (shared/ventaAbierta)
  puedeConfirmar: boolean;          // NUEVO: PUBLICADA && !ventaAbierta && fechaInicio > hoy. Propuesta
  servicios: ServicioSalidaApi[];   // CAMBIA: sale de Ocupacion (ALOJAMIENTO puede venir varias veces, B10)
  alertas: AlertaSalida[];          // CAMBIA: códigos nuevos
  avisos: { alerta: AlertaSalida; mensaje: string }[]; // NUEVO: el detalle legible. Propuesta
};

type ServicioSalidaApi = {          // la misma forma de hoy (salidaService.ts:33), ahora armada desde Ocupacion
  idsalida: number;
  idservicio: number;
  tipo: "ALOJAMIENTO" | "TRANSPORTE";
  comprobanteReserva: string | null;
  servicio: { nombreServicio: string };
};

type AlertaSalida =
  | "SOLICITUD_PENDIENTE" | "PERMISOS_SIN_CONFIRMAR" | "SIN_INICIAR" | "SIN_AVANCES" | "SIN_FINALIZAR" // de hoy
  | "FALTA_RECURSO"        // NUEVO (B4): alguna necesidad sin ocupación suficiente (equipo, transporte o plazas)
  | "RIESGO_STOCK"         // NUEVO (A2b): si se vende completa, faltaría equipo
  | "PERSONAL_NO_APTO"     // NUEVO (12.3): alguien del personal asignado venció, se dio de baja o perdió la cuenta
  | "PENDIENTE_CONFIRMAR"; // NUEVO, Propuesta: terminó la venta y la salida sigue PUBLICADA
```
- **`servicios`:** A1 borra `SalidaServicio`. **Decidido:** la respuesta conserva la forma de hoy para que no se rompan `SalidasPage` ni el mock (`salidas.ts:54`, que busca `tipo === "TRANSPORTE"`).
- **Las alertas nuevas no esperan los 7 días** de `DIAS_ALERTA`: aparecen apenas se cumple la condición. `PENDIENTE_CONFIRMAR` deja de aparecer cuando la salida pasa a CERRADA.
- **Ejemplos de `avisos[].mensaje`:**
  - `FALTA_RECURSO`: "Faltan 2 de Carpa doble 4 estaciones el 12/03/2026", "Falta el transporte" o "El transporte Coaster tiene 20 asientos y la salida necesita 25 lugares" (etapa 3: lleva el nombre del servicio)
  - `RIESGO_STOCK`: "Si se vende completa faltarían hasta 3 de Carpa doble 4 estaciones el 12/03/2026"
  - `PERSONAL_NO_APTO`: "Juan Pérez: la habilitación vence el 10/03/2026"
  - `PENDIENTE_CONFIRMAR`: "La venta cerró el 08/03/2026: falta confirmar la salida"
- **Etiquetas en el front (B11):** `FALTA_RECURSO` → "Falta equipo o transporte", `RIESGO_STOCK` → "Equipo justo", `PERSONAL_NO_APTO` → "Personal no apto" y `PENDIENTE_CONFIRMAR` → "Para confirmar". Las elige B.

---

## 7. Catálogo público: Sale desde, venta cerrada, precio, reintegro y tren — B2, B4, B6, B9, 12.5, 12.7

`GET /api/catalogo` · **público**. Hoy: `catalogo.service.ts`, y en el front `catalogoCompraService.ts:21` y `:45`.

```ts
type PaqueteCatalogoPublico = {
  // ...los campos de hoy
  saleDesde: string;                 // NUEVO (B2): localidadGarantizada. El front muestra "Sale desde Cusco"
  serviciosIncluidos: string[];      // CAMBIA (B9): el tren lleva su horario, "Tren Expedition (sale 06:10, llega 07:45)"
  serviciosAdicionales: string[];    // CAMBIA: igual que serviciosIncluidos (son el mismo arreglo)
  equipajeTransporte?: never;        // SE ELIMINA (B6)
  salidasDisponibles: SalidaDisponibleCatalogo[];
};

type SalidaDisponibleCatalogo = {
  // ...los campos de hoy
  precioPersona: number | null;      // CAMBIA (12.5): la tarifa congelada en la salida; las salidas viejas siguen con la del paquete
  ventaAbierta: boolean;             // NUEVO (B4)
  ultimoDiaVenta: string;            // NUEVO: "AAAA-MM-DD"
  fechaLimiteReintegro: string | null; // NUEVO (12.7): "AAAA-MM-DD" = fechaInicio − diasMinimosReintegro; null = siempre hay reintegro
  equipajeTransporte?: never;        // SE ELIMINA (B6)
};
```
- **Qué salidas se listan:** las PUBLICADAS con `fechaInicio > hoy`, como hoy, **incluidas las de venta cerrada** con `ventaAbierta: false`, para que el front muestre "Venta cerrada" (B4).
- **Decidido:** una salida llena sigue con `ventaAbierta: true` y `cupoDisponible: 0`. El front la muestra "Agotada".
- **12.7:** el plan dice que el dato ya viene en la salida, pero el catálogo de hoy no lo manda (`catalogo.service.ts:7`, `definicionDeSalida`). Por eso se suma `fechaLimiteReintegro`. El front muestra "Esta fecha ya no tiene reintegro si cancelás" cuando `hoy > fechaLimiteReintegro`, en la ficha y en el pago. La regla es la misma de `reintegro.ts:36` (`faltan < diasMinimos`).
- **Propuesta (B9):** el horario del tren va como texto dentro de `serviciosIncluidos`, que el front ya muestra, para no sumar un tipo nuevo.

---

## 8. Compra (CU-30): sin equipaje y con hotel asignado — B6, B10, 12.1, 12.2

`POST /api/reservas` · **CLIENTE**. Hoy: `reserva.dto.ts`, `reserva.service.ts`, y en el front `catalogoCompraService.ts:91`.

```ts
type CrearReservaPayload = {
  idsalida: number;
  medioPago: string;
  pasajeros: PasajeroReservaInput[];
  tarjeta: TarjetaReservaInput;
  equipaje?: never;          // SE ELIMINA (B6). Propuesta: si llega, se ignora
};

type ResultadoReservaConfirmada = {
  idreserva: number;
  nroReserva: string;
  estado: string;
  estadoAlojamiento: "CONFIRMADO" | "PENDIENTE";  // PENDIENTE si le tocó un hotel a solicitud, como hoy
  hotel: { idservicio: number; nombreServicio: string } | null; // NUEVO (12.2). Propuesta: null si el paquete no tiene noches
  cantidadPasajeros: number;
  precioCongelado: number;   // CAMBIA: tarifa congelada × pasajeros, sin adicionales (B6, 12.5)
  moneda: string;
  transaccionPasarela: string;
};
```

| Código | Mensaje | Bloque |
|---|---|---|
| 400 | `La venta de esta salida cerró el 08/03/2026.` (cuando está PUBLICADA pero `ventaAbierta` da false) | B4 |
| 400 | `Quedan 4 lugares, pero no en un mismo hotel.` | 12.2 |
| 400 | `Solo quedan 2 lugares en esta salida.` (el de hoy) | — |

- **El equipo no frena la compra:** se vende igual, y si falta aparece `FALTA_RECURSO` en el admin (B4). No hay un error nuevo para el cliente.
- **Detalle de la reserva** (`GET /api/reservas/:id`, `gestion-reserva.service.ts:239-295`): `adicionales` y `adicionalesEquipaje` **SE ELIMINAN** del desglose.
- **Cancelar una reserva (CU-32):** la API no cambia. Por dentro recalcula el equipo (12.1).

---

## 9. Confirmar salida (CU-40) — B4

Hoy: `asignacion.service.ts` y `asignacion.dto.ts`, y en el front `salidaService.ts:192-290`.
**Decidido:** se mantienen las rutas (`GET` y `POST /api/salidas/:idsalida/asignacion`) y cambian los cuerpos, para no tocar el router ni los hooks. `POST …/asignacion/liberar-sobrantes` queda igual.

### 9.1 Panel de control
`GET /api/salidas/:idsalida/asignacion` · **ADMIN**. Funciona en cualquier momento antes del inicio, y el botón depende de `puedeConfirmar`.

```ts
type PanelConfirmacion = {
  salida: {
    idsalida: number; nroSalida: string; fechaInicio: string; fechaFin: string;
    estado: string; ultimoDiaVenta: string; ventaAbierta: boolean;
  };
  puedeConfirmar: boolean;               // !ventaAbierta && faltantes vacío && PUBLICADA
  motivoNoConfirmable: string | null;    // p. ej. "La venta sigue abierta hasta el 08/03/2026"
  pasajerosConfirmados: number;
  dotacionRequerida: { guias: number; porteadores: number }; // por pasajeros vendidos
  personal: {
    idpersonal: number; nombreCompleto: string; rol: "Guía" | "Porteador";
    apto: boolean; motivo: string | null; // 12.3, p. ej. "La habilitación vence el 10/03/2026"
  }[];
  porteadoresSobrantes: number;          // decisión 5: solo avisa
  hoteles: {
    idservicio: number; nombreServicio: string;
    modalidadConfirmacion: "BLOQUEO_PLAZAS" | "A_SOLICITUD";
    pasajeros: number;                   // los que la compra mandó a ese hotel (12.2)
  }[];
  transporte: { idservicio: number; nombreServicio: string; capacidadVehiculo: number; alcanza: boolean } | null;
  equipo: {
    idservicio: number; nombreServicio: string; tipoEquipamiento: string;
    necesita: number;                    // ceil(vendidos / cadaPasajeros) × cantidad
    ocupado: number;
    falta: number;                       // 0 si alcanza
  }[];
  reservasSinAlojamiento: string[];      // nroReserva con el alojamiento PENDIENTE (el FA5 de hoy)
  faltantes: string[];                   // lo que impide confirmar, en texto
  bloqueoInicial: number;                // como hoy
  lugaresSobrantes: number;              // como hoy
};
// SE ELIMINAN de la respuesta de hoy: personalDisponible, transportesDisponibles y stockCamping
```

### 9.2 Confirmar
`POST /api/salidas/:idsalida/asignacion` · **ADMIN** · body `{}`. Hoy es `{ personalIds, idtransporte, itemsCamping }`, que **SE ELIMINA**.

Sigue emitiendo los permisos y liberando los sobrantes ante la autoridad, como hoy. **Decidido:** la respuesta es la de hoy (`DatosResultadoConfirmarAsignacion`), salvo `salida`, que se achica:
```ts
type RespuestaConfirmarSalida = {
  mensaje: string; // "Salida confirmada y permisos de la nómina emitidos", o "Salida confirmada: 18 permisos emitidos y 1 rechazado…"
  data: {
    salida: { idsalida: number; nroSalida: string; estado: "CERRADA" }; // CAMBIA: B recarga el listado
    permisosEmitidos: number;
    rechazados: { tipo: "PASAJERO" | "PERSONAL"; id: number; nombreCompleto: string; motivo: string }[];
    lugaresLiberados: number;
    advertencia?: string;
  };
};
```

| Código | Mensaje |
|---|---|
| 404 | `La salida no existe` |
| 400 | `La venta sigue abierta hasta el 08/03/2026: la salida se confirma después del corte` (decisión 4) |
| 400 | `La salida ya está confirmada` |
| 400 | `No se puede confirmar una salida que ya inició o no está activa` |
| 400 | `La salida no tiene pasajeros confirmados: corresponde cancelarla` |
| 409 | `No se puede confirmar: hay alojamientos sin confirmar en las reservas RES-…` (el FA5 de hoy) |
| 409 | `Falta resolver antes de confirmar: faltan 2 carpas el 12/03/2026. Juan Pérez tiene la habilitación vencida` (**Decidido:** `faltantes` bloquea) |
| 409 | `La salida cambió mientras se confirmaba. Volvé a cargar el panel` |
| 503 | `No fue posible emitir los permisos ante la autoridad. Reintentá más tarde` (el de hoy) |

- **Cómo se resuelven los faltantes:** el personal con CU-38 (`/reemplazos`, que ya acepta PUBLICADA), y el equipo o el transporte con CU-39, o subiendo el total en Proveedores.
- **Decidido:** CU-39 (`PUT /api/salidas/:id/logistica`) pasa a aceptar salidas PUBLICADAS. Hoy las rechaza (`logistica.service.ts:88`, "La salida todavía no tiene recursos asignados").

---

## 10. Guía: ve la salida desde que se crea y los horarios del tren — B3, B9

- **`GET /api/guia/salidas`** · **GUIA**: suma las PUBLICADAS (se revierte `guia.repository.ts:17`). La forma no cambia.
- **`GET /api/guia/salidas/:idsalida`:** se suma un campo.
  ```ts
  tren: { nombreServicio: string; horarioSalida: string; horarioLlegada: string } | null; // NUEVO
  ```
- **Decidido:** `POST /api/guia/salidas/:id/iniciar` exige CERRADA. Hoy acepta PUBLICADA (`guia.service.ts:96`), y con el cambio el guía la vería antes de que tenga los permisos emitidos. El error sería 400 `La salida todavía no está confirmada por la agencia`.

---

## 11. Personal bloqueado por salidas — 12.8

`PATCH /api/personal/:id/baja` y `PUT /api/personal/:id` · **ADMIN**. Hoy: `personal.service.ts:37-73` y `:110`. Los mensajes de hoy no dicen qué salidas son.

**Decidido:** estos rechazos pasan a 409, con `detalle` (sección 0):
```ts
type DetallePersonalBloqueado = {
  salidas: { idsalida: number; nroSalida: string; fechaInicio: string; fechaFin: string; estado: string }[];
};
```
| Código | Mensaje | Hoy |
|---|---|---|
| 409 | `No se puede dar de baja: está asignado a SAL-2026-004 y SAL-2026-007, que todavía no finalizaron` (con una sola: `…, que todavía no finalizó`) | 400, solo con la cantidad (`personal.service.ts:110`) |
| 409 | `El pasaporte no puede vencer antes de que termine SAL-2026-007 (15/03/2026)` | 409 con la fecha (`:49`) |
| 409 | `La habilitación no puede vencer antes de que termine SAL-2026-007 (15/03/2026)` | 409 con la fecha (`:56`) |
| 409 | `No se pueden modificar el nombre ni el pasaporte: tiene permiso emitido en SAL-2026-004` | 409 (`:72`) |

- **El botón "Reemplazar en la salida"** lleva a CU-38 con `detalle.salidas[i].idsalida` y el `idpersonal` de la ficha. Usa los endpoints de hoy: `GET /api/salidas/:idsalida/personal/:idpersonal/reemplazantes` y `POST /api/salidas/:idsalida/reemplazos`.

---

## 12. Referencia para A: la definición congelada — B2, B4, 12.5

Hoy: `shared/definicionPaquete.ts:6`. El front no la lee directo: le llega a través del catálogo y la compra.
```ts
type DefinicionPaquete = {
  // ...los campos de hoy, salvo servicios
  servicios: {
    idservicio: number;
    nombreServicio: string;
    tipo: "TRANSPORTE" | "TREN" | "EQUIPAMIENTO";            // NUEVO
    cantidad: number | null;                                // NUEVO
    cadaPasajeros: number | null;                           // NUEVO
    tren: { horarioSalida: string; horarioLlegada: string } | null; // NUEVO
    transporte?: never;                                     // SE ELIMINA (franquicia de equipaje, B6)
  }[];
  diasCierreVenta: number;                                  // NUEVO
  tarifa: { idtemporada: number; temporada: string; monto: number; moneda: string } | null; // NUEVO (12.5). null en las salidas viejas
};
```
- Hay que actualizar el comentario de `definicionPaquete.ts:3` ("Las tarifas NO van en la foto"), porque 12.5 lo invierte.

---

## Qué mockear primero (en el orden del calendario de B)

| Día | Qué | Dónde (mocks) | Sección |
|---|---|---|---|
| Sáb 21 – Dom 22 | `POST /reservas` sin `equipaje`, y catálogo y detalle de reserva sin `equipajeTransporte` ni `adicionales` | `manejadores/catalogoReservas.ts` | 7, 8 (B6) |
| Sáb 21 – Dom 22 | Alojamiento a solicitud sin `capacidadDisponible`, sus errores nuevos, y el transporte sin los campos de equipaje | `manejadores/servicios.ts`, `datos/servicios.ts` | 2 (B8) |
| Lun 23 | `POST /paquetes/costos/simular` (B escribe el real, el mock sirve hasta que esté) | `manejadores/paquetes.ts` | 4 (B5) |
| Lun 23 | `ErrorApi.detalle` en `clienteApi.ts`, porque lo usan el miércoles y el jueves | `services/clienteApi.ts` | 0 |
| Mar 24 | Paquete con `localidadGarantizada` obligatoria, `idtransporte`, `idtren`, `equipo`, `diasCierreVenta`, `faltaTransporte` y `calendarioSalidas`, en el GET, el POST y el PUT | `manejadores/paquetes.ts`, `datos/paquetes.ts` | 3 (B2, B4) |
| Mié 25 | `GET /salidas/opciones` ampliado: hoteles con modalidad, transportes, personal, equipo, tren y tarifa | `manejadores/salidas.ts:180` | 5.1 (B3, B9, B10) |
| Mié 25 | `POST /salidas` con el body nuevo, `advertencias` y los errores de 5.3 (incluido el 409 de equipo con `detalle`) | `manejadores/salidas.ts:302` | 5.2, 5.3 |
| Mié 25 | Listado con `ventaAbierta`, `ultimoDiaVenta`, `puedeConfirmar`, las alertas nuevas y `avisos` | `manejadores/salidas.ts:76`, `datos/salidas.ts` | 6 (B4, 12.3) |
| Mié 25 | Panel de confirmación y `POST …/asignacion` con body vacío y sus errores | `manejadores/salidas.ts:714` y `:746` | 9 (B4) |
| Mié 25 | Catálogo con `saleDesde`, `ventaAbierta`, `ultimoDiaVenta` y el tren en `serviciosIncluidos` | `manejadores/catalogoReservas.ts:685` | 7 (B2, B4, B9) |
| Jue 26 | `GET /servicios/:id/ocupacion` para el historial (si el back real de A1 ya está mergeado desde el lunes, se puede saltear el mock) | `manejadores/servicios.ts` | 1 (B1) |
| Jue 26 | Catálogo con `fechaLimiteReintegro`, y compra con `hotel` y el error "no en un mismo hotel" | `manejadores/catalogoReservas.ts:975` | 7, 8 (12.7, 12.2) |
| Jue 26 | Baja y edición de personal con el 409 y `detalle.salidas` | `manejadores/personal.ts:263` y `:411` | 11 (12.8) |
| Jue 26 | Guía: salidas PUBLICADAS en la lista y `tren` en la ficha | `manejadores/guia.ts:25` y `:34`, `datos/guia.ts` | 10 (B3, B9) |

---

## 13. Diferencias de la implementación (etapa 3 del back, 21/11)

Lo que el back devuelve distinto de lo de arriba, o lo que el contrato no decía. Los mensajes de las tablas ya están corregidos.

- **Sección 0:** `detalle` está en `CustomError.badRequest` y `CustomError.conflict` (los únicos que lo usan). Sin `detalle`, el cuerpo sigue siendo `{ error }`.
- **5.1 opciones:**
  - `dotacion.porteadores` sigue saliendo de `parametrosPorteadores` ("1 por cada 2 pasajeros"). Los dos enteros de A2 necesitan una migración y el formulario del circuito: quedan para después.
  - `alojamientos` lista solo los de `BLOQUEO_PLAZAS` (`modalidadConfirmacion` viene, pero siempre es esa). Los a solicitud se suman con el bloque 10.
  - `fechaCritica` viene siempre (el día con menos libre); nunca `null`.
- **5.2 alta:** acepta `alojamientos` con **un solo** id (con dos responde 400 `Por ahora la salida lleva un solo hotel: elegí uno`) y sigue aceptando `idalojamiento`. Varios hoteles es el bloque 10. El equipo queda con su fila de ocupación en 0 hasta la primera compra.
- **5.3:** el control de personal va en este orden: no apto (400), dotación (400), ocupado (409). El transporte: no existe (400), no alcanza (400), ocupado (409). Después, el equipo (409) y la fecha con el corte final (400).
- **6 listado:** `FALTA_RECURSO`, `PERSONAL_NO_APTO` y `RIESGO_STOCK` solo se calculan en las salidas PUBLICADA y CERRADA, y `RIESGO_STOCK` solo mientras `ventaAbierta`. El transporte se compara contra el máximo más el personal mientras se vende, y contra los vendidos más el personal en una CERRADA (12.4).
- **9.1 panel:** ya no responde 409 con alojamientos pendientes: los lista en `reservasSinAlojamiento` y `puedeConfirmar` queda en false. Responde 400 si la salida ya inició o no está activa. `hoteles[].pasajeros` cuenta las reservas con el alojamiento CONFIRMADO (un hotel por salida hasta el bloque 10). `faltantes` suma la dotación por los vendidos si alguien se quitó (`La salida necesita al menos 1 guías y 2 porteadores (tiene 1 y 1)`). `bloqueoInicial` es `tamanoMaximo + personal asignado` y `lugaresSobrantes` es `tamanoMaximo − vendidos`.
- **9.2 confirmar:** el orden de los rechazos es: inexistente (404), ya inició (400), ya confirmada (400), venta abierta (400), sin pasajeros (400), alojamientos pendientes (409) y faltantes (409). Los dos 409 traen `detalle: { reservasSinAlojamiento: string[]; faltantes: string[] }`. El pasaporte vencido del personal ya no es un 400 aparte: es un faltante (12.3).
- **CU-39 en una salida PUBLICADA:** si se cambia la cantidad de un equipo con regla, la próxima compra la vuelve a calcular. Si se quita, la compra no lo vuelve a poner. ponytail: se ajusta si hace falta un equipo "a mano" que la compra respete.
- **Salidas creadas antes de la etapa 3:** no tienen personal ni la fila del equipo. Muestran `FALTA_RECURSO` o no se pueden confirmar, y CU-40 ya no asigna: hay que recrearlas (la demo se regenera).
