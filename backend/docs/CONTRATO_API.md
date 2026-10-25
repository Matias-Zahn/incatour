# Contrato de la API de IncaTour

Guía para quien consume el backend (el front, o una IA que programe una pantalla).
Se lee junto con `openapi.json`, que tiene el detalle de cada endpoint.

- **Detalle de los endpoints:** `backend/docs/openapi.json`. Se abre en https://editor.swagger.io o, con el back corriendo, en http://localhost:3000/api-docs.
- **Regla de oro:** los tipos, los nombres de campos y los mocks se copian de `openapi.json`. Nunca se inventan.
- **Para regenerar `openapi.json`** después de cambiar un endpoint: `npm run docs` desde `backend`.

---

## 1. Reglas generales

### URL y autenticación
- **URL base:** `http://localhost:3000/api`. El back tiene CORS habilitado.
- **Login:** `POST /api/auth/login` con `{ "email", "contrasenia" }`.
- **Respuesta del login:**
  ```json
  { "data": { "usuario": { "idusuario": 1, "email": "...", "nombre": "...", "apellido": "...", "rol": "ADMIN" }, "token": "eyJ..." } }
  ```
- **El token** dura **8 horas** y va en cada pedido como `Authorization: Bearer <token>`.
- **Perfiles (`rol`):** `ADMIN`, `CLIENTE` y `GUIA`. Cada endpoint dice en su descripción qué perfil exige.
- **El token no trae `idcliente` ni `idpersonal`:** los endpoints del cliente y del guía los deducen del token. Por eso no se mandan en el body.
  - Para consultar el perfil del cliente sin conocer su `idcliente`: `GET /api/clientes/mi-perfil` (solo CLIENTE; misma forma que `GET /api/clientes/{id}`).
- **Endpoints públicos (sin token):**
  - `POST /api/auth/login`;
  - `POST /api/clientes` (registro);
  - `GET /api/catalogo` (catálogo público).

### Formato de las respuestas
- **Consultas:** los datos vienen en `data`.
  ```json
  { "data": [ ... ] }
  ```
- **Acciones** (crear, modificar, dar de baja): traen además un `mensaje` para mostrar al usuario.
  ```json
  { "mensaje": "Salida creada y publicada exitosamente", "data": { ... } }
  ```
- **Todos los endpoints usan este formato,** sin excepciones. Algunas consultas agregan campos extra al lado de `data`, como `cantidad`.

### Errores
- **Siempre tienen esta forma:**
  ```json
  { "error": "Mensaje para mostrar al usuario" }
  ```
- **El texto de `error` está pensado para el usuario final:** se muestra tal cual.

| Código | Significa | Qué hace el front |
|---|---|---|
| 400 | Dato inválido o regla de negocio | Mostrar `error` y dejar corregir |
| 401 | Sin token, o token vencido | Volver al login |
| 403 | El perfil no tiene permiso, o el recurso no es suyo | Mostrar `error` |
| 404 | No existe | Mostrar `error` |
| 409 | Conflicto (por ejemplo, alojamientos pendientes en el CU-40) | Mostrar `error` |
| 503 | La autoridad no responde | Mostrar `error` y ofrecer reintentar |
| 500 | Error inesperado del servidor | Mensaje genérico |

### Convenciones
- **Ids:** se llaman como en la base: `idsalida`, `idproveedor`, `idpersonal`, `idreserva`… Nunca `id` a secas. La excepción son algunos parámetros de ruta, como `/api/proveedores/{id}`.
- **Bajas:** son lógicas, con `PATCH /recurso/{id}/baja`. **No existe ningún `DELETE`.** Lo dado de baja queda con `estado: "INACTIVO"`.
- **Fechas:** en ISO 8601. Puede ser solo la fecha (`"2026-12-10"`) o fecha y hora con zona (`"2026-12-10T14:35:00-05:00"`). Las respuestas vienen en UTC (`"2026-12-10T19:35:00.000Z"`).
- **Filtros de las consultas:** van por query string (`?estado=ACTIVO&idpaquete=1`) y todos son opcionales.

---

## 2. Cómo usarlo desde el front

**Todo pasa por `frontend/src/services/clienteApi.ts`.** Tiene que:
1. **Agregar el token** a cada pedido: `Authorization: Bearer ${token}`.
2. **Leer el error de `cuerpo.error`,** no de `cuerpo.mensaje`.
3. **Ante un 401,** borrar la sesión y llevar al login.

```ts
if (!respuesta.ok) {
  if (respuesta.status === 401) cerrarSesion(); // vuelve al login
  const cuerpo = await respuesta.json().catch(() => ({}));
  throw new ErrorApi(respuesta.status, cuerpo.error ?? "Ocurrió un error inesperado.");
}
```

Los servicios de cada recurso devuelven `respuesta.data`, así las pantallas no tienen que desarmar la respuesta.

**Para probar antes de que exista el login:** pedí un token en `/api-docs` (`POST /api/auth/login`) y pegalo a mano.

---

## 3. Flujos de varios pasos

Muchas pantallas no son un solo endpoint: primero se consulta, y después se confirma con lo que eligió el usuario.

| CU | Pantalla | Paso 1 (consultar) | Paso 2 (confirmar) |
|---|---|---|---|
| 36 | Crear salida | `GET /api/salidas/opciones?idpaquete&fechaInicio&tamanoMaximo`: dotación, total de lugares, cupo libre de la autoridad (`cupoAutoridad`, null si no responde) y alojamientos | `POST /api/salidas` con `idalojamiento` elegido de las opciones |
| 40 | Asignar recursos | `GET /api/salidas/{id}/asignacion`: dotación, sobrantes, personal, transportes y camping disponibles | `POST /api/salidas/{id}/asignacion` con `personalIds`, `idtransporte` e `itemsCamping`. La respuesta trae `rechazados` (`tipo`, `id`, `nombreCompleto`, `motivo`) si la autoridad no emitió el permiso de alguien (RF-47): la asignación se confirma igual y se muestra el aviso |
| 38 | Reemplazar personal | `GET /api/salidas/{id}/personal`, y después `GET /api/salidas/{id}/personal/{idpersonal}/reemplazantes` | `POST /api/salidas/{id}/reemplazos` con `idoriginal`, `idreemplazante` y `motivo` |
| 37 | Cancelar salida | `GET /api/salidas/{id}/cancelacion`: impacto (reservas y reembolsos) | `POST /api/salidas/{id}/cancelar` con el motivo |
| 39 | Modificar logística | `GET /api/salidas/{id}/logistica`, y después `GET …/logistica/disponibles` | `PUT /api/salidas/{id}/logistica` |
| 41 | Devolución de equipamiento | `GET /api/salidas/{id}/equipamiento-asignado` | `POST /api/salidas/{id}/devolucion-equipamiento` |
| 42 | Evaluar personal y proveedores | `GET /api/salidas/{id}/evaluaciones` | `POST /api/salidas/{id}/evaluaciones` con `tipo` (`PERSONAL` o `PROVEEDOR`), `id` y `puntaje` (1 a 5) |
| 32 | Cancelar reserva (cliente) | `GET /api/reservas/{id}/cancelacion`: liquidación con `montoAReintegrar` y `condicionAplicada` (el admin siempre reintegra el 100%; el cliente, $0 si cancela con menos días que `diasMinimosReintegro` del paquete o con permisos emitidos) | `POST /api/reservas/{id}/cancelar` |
| 34 | Resolver solicitud de alojamiento | `GET /api/solicitudes/{id}/opciones` | `POST /api/solicitudes/{id}/resolver` |
| 47 | Publicar reseña (cliente) | `GET /api/resenias/historial-reservas` | `POST /api/resenias` |
| 20 | Modificar servicio | `GET /api/servicios/{id}` | `PUT /api/servicios/{id}` |
| 5 | Etapas del circuito | `GET /api/circuitos/{idcircuito}/etapas` | `PUT` con **todas** las etapas: reemplaza la secuencia completa |
| 49, 50 | Portal del guía | `GET /api/guia/salidas`, y después `GET /api/guia/salidas/{id}` | `POST …/avances` o `POST …/incidentes`. Para los afectados: `GET …/pasajeros` |

**Compra (CU-30):** es un solo `POST /api/reservas` con los pasajeros, el equipaje, el medio de pago y la tarjeta. Si el pago se rechaza, responde 400 con el motivo y no queda nada reservado. Tarjetas de prueba del mock de la pasarela:
- termina en `0000`: fondos insuficientes;
- termina en `1111`: tarjeta robada;
- CVV `999`: falla de seguridad;
- cualquier otra: aprobada.

La reserva guarda lo que vio el cliente al comprar: `precioCongelado`, `temporadaAplicada`, `precioPaquetePorPersona`, `adicionalesEquipaje`, `moneda`, `condicionesComerciales` y `diasMinimosReintegro`. Cada salida guarda la definición del paquete con la que se creó (`definicionPaquete`); modificar el paquete no cambia las salidas ya creadas, y su circuito no se puede cambiar mientras tenga salidas activas.

---

## 4. Usuarios de prueba (seed)

| Perfil | Email | Contraseña |
|---|---|---|
| ADMIN | admin@incatour.com | AdminIncaTour123 |
| CLIENTE | juan@test.com | hash123 |
| GUIA | carlos.guia@incatour.com | guia123 |

Para cargar la base local: `npx prisma migrate reset` y después `npm run db:seed`, desde `backend`.

---

## 5. Para pedirle una pantalla a una IA

Pasale este archivo y **solo la parte de `openapi.json`** de los endpoints de esa pantalla, no el archivo entero. Por ejemplo:

> Leé `CONTRATO_API.md`. Armá la pantalla del CU-36 (crear salida) usando `GET /api/salidas/opciones` y `POST /api/salidas`, con este fragmento de `openapi.json`: […]. Usá `clienteApi` y los componentes de `frontend/src/components`. No inventes campos que no estén en el fragmento.
