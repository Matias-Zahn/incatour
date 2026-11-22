import { Router } from "express";
import { SalidaController } from "./salida.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class SalidaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new SalidaController();

    /**
     * @swagger
     * /api/salidas:
     *   get:
     *     summary: Consultar salidas (CU-35)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Lista las salidas con su paquete, personal asignado y servicios,
     *       ordenadas por fecha de inicio. Todos los filtros son opcionales. Cada salida trae además (RF-50 y RF-61):
     *       pasajerosConfirmados, cantidadPersonal, guias, permisosFaltantes (pasajeros + personal − permisos emitidos),
     *       etapaEsperada / etapaInformada / etapaDesfasada (solo EN_CURSO; la esperada reparte las etapas en
     *       proporción a los días del circuito) y alertas: SOLICITUD_PENDIENTE y PERMISOS_SIN_CONFIRMAR cuando la
     *       salida empieza dentro de 7 días.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: query, name: idpaquete, schema: { type: integer } }
     *       - { in: query, name: estado, schema: { type: string, example: PUBLICADA } }
     *       - { in: query, name: desde, schema: { type: string, format: date }, description: Fecha de inicio desde. }
     *       - { in: query, name: hasta, schema: { type: string, format: date }, description: Fecha de inicio hasta. }
     *       - { in: query, name: idguia, schema: { type: integer }, description: idpersonal de un guía asignado. }
     *       - { in: query, name: idcircuito, schema: { type: integer }, description: Circuito del paquete. }
     *     responses:
     *       200:
     *         description: Lista de salidas.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 data:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/Salida' }
     *       400: { description: Filtro inválido o desde posterior a hasta. }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     *
     * components:
     *   schemas:
     *     Salida:
     *       type: object
     *       properties:
     *         idsalida: { type: integer, example: 2 }
     *         idpaquete: { type: integer, example: 1 }
     *         nroSalida: { type: string, example: SAL-2026-002 }
     *         idbloqueo: { type: string, example: BLQ-FE517B3A, description: Bloqueo otorgado por la autoridad. }
     *         stockLocal: { type: integer, example: 8, description: Pasajes disponibles para la venta. }
     *         stockLocalAlojamiento: { type: integer, example: 8, description: Plazas de hotel bloqueadas disponibles. }
     *         tamanoMaximo: { type: integer, example: 8 }
     *         fechaInicio: { type: string, format: date-time }
     *         fechaFin: { type: string, format: date-time }
     *         estado: { type: string, example: PUBLICADA }
     */
    router.get("/", autenticar, requierePerfil("ADMIN"), controller.consultarSalidas);

    /**
     * @swagger
     * /api/salidas/opciones:
     *   get:
     *     summary: Opciones para crear una salida (CU-36, pasos 4 a 7)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Calcula la dotación de personal que exige el circuito,
     *       el total de lugares a bloquear ante la autoridad y los alojamientos que cumplen la garantía
     *       del paquete y confirman por bloqueo de plazas. También informa cuántos lugares libres tiene la autoridad
     *       ese día (`cupoAutoridad`, `null` si la autoridad no responde), la tarifa, los transportes (con el del paquete,
     *       si están libres y si alcanzan para pasajeros más dotación), el personal apto y libre en esas fechas (ordenado
     *       por salidas en el mes) y el equipo del paquete contra el stock proyectado (OK, RIESGO o NO_ALCANZA). No modifica nada.
     *       La forma completa está en docs/contratos-viernes.md, sección 5.1.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: query, name: idpaquete, required: true, schema: { type: integer, example: 1 } }
     *       - { in: query, name: fechaInicio, required: true, schema: { type: string, format: date, example: "2026-11-20" } }
     *       - { in: query, name: tamanoMaximo, required: true, schema: { type: integer, example: 8 } }
     *     responses:
     *       200:
     *         description: Dotación, total de lugares y alojamientos posibles.
     *         content:
     *           application/json:
     *             example:
     *               data:
     *                 paquete: { idpaquete: 1, nombrePaquete: Inca Clásico Standard }
     *                 tamanoMaximo: 8
     *                 dotacion: { guias: 2, porteadores: 4 }
     *                 totalLugares: 14
     *                 cupoAutoridad: { lugaresDisponibles: 500, alcanza: true }
     *                 alojamientos:
     *                   - { idservicio: 1, nombreServicio: Hotel Montaña, localidad: Cusco, categoria: 3 Estrellas, capacidadDisponible: 10, alcanza: true }
     *       400: { description: Datos inválidos, fecha pasada, paquete inactivo, sin tarifa vigente o sin parámetros de dotación. }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     *       404: { description: El paquete no existe. }
     */
    router.get("/opciones", autenticar, requierePerfil("ADMIN"), controller.consultarOpcionesSalida);

    /**
     * @swagger
     * /api/salidas:
     *   post:
     *     summary: Crear salida planificada (CU-36)
     *     description: >
     *       **RESTRINGIDO A ADMINISTRADOR.** Bloquea ante la autoridad el tamaño máximo más el personal elegido,
     *       asigna el personal (tiene que cubrir la dotación del máximo y ser apto hasta el fin), ocupa el hotel y el
     *       transporte (que tiene que llevar a pasajeros y personal) y publica la salida. El equipo del paquete se controla
     *       contra el stock proyectado: bajo el 50 % responde 409 con `detalle`, entre el 50 y el 100 % crea con `advertencias`;
     *       no se ocupa hasta la primera compra. Si la base falla después del bloqueo, el cupo se libera.
     *       alojamientos (B10): uno o más hoteles de las opciones que entre todos cubran el máximo (uno a solicitud cubre lo
     *       que falte); vacío solo si ninguno cubre (FA3), y entonces cada reserva generará su solicitud.
     *     tags: [Salidas]
     *     security:
     *       - BearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [idpaquete, fechaInicio, tamanoMaximo, idtransporte, personalIds]
     *             properties:
     *               idpaquete: { type: integer, example: 1 }
     *               fechaInicio: { type: string, format: date, example: "2026-11-20" }
     *               tamanoMaximo: { type: integer, example: 8 }
     *               alojamientos: { type: array, items: { type: integer }, example: [1, 2], description: "Hoteles de /api/salidas/opciones, en el orden en que se llenan. idalojamiento (un id) se acepta igual." }
     *               idtransporte: { type: integer, example: 3 }
     *               personalIds: { type: array, items: { type: integer }, example: [1, 4, 5, 6, 7] }
     *               diasCierreVenta: { type: integer, example: 2 }
     *     responses:
     *       201:
     *         description: Salida creada y publicada.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 mensaje: { type: string }
     *                 data:
     *                   type: object
     *                   properties:
     *                     salida: { $ref: '#/components/schemas/Salida' }
     *                     dotacion: { type: object, properties: { guias: { type: integer }, porteadores: { type: integer } } }
     *                     totalLugares: { type: integer, example: 14 }
     *                     advertencias: { type: array, items: { type: string } }
     *       400: { description: Datos inválidos, alojamiento no válido o sin elegir, personal no apto o que no cubre la dotación, transporte sin capacidad para pasajeros y personal, o sin cupo suficiente (FA1, informa los lugares disponibles). }
     *       409: { description: "El hotel, el transporte o el personal se ocuparon en el medio, o no alcanza el equipo (detalle: faltantes y tamanoMaximoSugerido)." }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil ADMIN. }
     *       404: { description: El paquete no existe. }
     *       503: { description: La autoridad no responde (FA2). Reintentar más tarde. }
     */
    router.post("/", autenticar, requierePerfil("ADMIN"), controller.confirmarCreacionSalida);

    return router;
  }
}
