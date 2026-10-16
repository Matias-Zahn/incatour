import { Router } from "express";
import { GuiaController } from "./guia.controller";
import { autenticar, requierePerfil } from "../../../shared/auth/auth.middleware";

export class GuiaRoutes {
  static get getRoutes(): Router {
    const router = Router();
    const controller = new GuiaController();

    router.use(autenticar, requierePerfil("GUIA"));

    /**
     * @swagger
     * /api/guia/salidas:
     *   get:
     *     summary: Mis salidas asignadas (CU-48)
     *     description: >
     *       **RESTRINGIDO A GUÍA.** Salidas a las que está asignado el guía del token, sin las canceladas,
     *       ordenadas por fecha. Es el punto de entrada para registrar avances (CU-49) e incidentes (CU-50).
     *     tags: [Portal del guía]
     *     security:
     *       - BearerAuth: []
     *     responses:
     *       200:
     *         description: Salidas asignadas.
     *         content:
     *           application/json:
     *             example:
     *               data:
     *                 - { idsalida: 2, nroSalida: SAL-2026-002, paquete: Inca Clásico Standard, circuito: Camino del Inca Clásico, fechaInicio: "2026-12-10T00:00:00.000Z", fechaFin: "2026-12-13T00:00:00.000Z", estado: CERRADA, pasajeros: 3 }
     *       401: { description: Token no proporcionado o inválido. }
     *       403: { description: Se requiere el perfil GUIA, o la cuenta no está vinculada a un guía. }
     */
    router.get("/salidas", controller.consultarSalidasAsignadas);

    /**
     * @swagger
     * /api/guia/salidas/{idsalida}:
     *   get:
     *     summary: Información de la salida asignada (CU-48)
     *     description: >
     *       **RESTRINGIDO A GUÍA.** Itinerario tramo a tramo (con el último avance informado de cada etapa),
     *       nómina de pasajeros con el contacto del titular de su reserva, personal, servicios y equipamiento.
     *       Solo para salidas a las que el guía está asignado.
     *     tags: [Portal del guía]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     responses:
     *       200:
     *         description: Detalle de la salida.
     *         content:
     *           application/json:
     *             example:
     *               data:
     *                 salida: { idsalida: 2, nroSalida: SAL-2026-002, circuito: Camino del Inca Clásico, duracionDias: 4, estado: CERRADA }
     *                 itinerario: [{ numeroOrden: 1, puntoInicio: Km 82, puntoFin: Wayllabamba, campamentoPrevisto: Wayllabamba Camp, estadoTramo: null, fechaHoraLlegada: null }]
     *                 nomina: [{ idpasajero: 2, nombreCompleto: Turista 1, nroPasaporte: TP-1, nacionalidad: Argentina, nroReserva: RES-1, contacto: { titular: Juan Pérez, email: juan@test.com } }]
     *                 personal: [{ idpersonal: 1, nombreCompleto: Carlos Mamani, rol: Guía }]
     *                 servicios: [{ tipo: TRANSPORTE, nombreServicio: Minibus Sprinter }]
     *                 equipamiento: [{ nombreServicio: Carpas Alta Montaña, tipoEquipamiento: Carpa 4 Estaciones, cantidad: 2 }]
     *       400: { description: Id inválido. }
     *       403: { description: El guía no está asignado a esa salida. }
     *       404: { description: La salida no existe. }
     */
    router.get("/salidas/:idsalida", controller.consultarDetalleSalida);

    /**
     * @swagger
     * /api/guia/salidas/{idsalida}/avances:
     *   post:
     *     summary: Registrar avance del recorrido (CU-49)
     *     description: >
     *       **RESTRINGIDO A GUÍA.** El guía asignado informa la llegada al final de una etapa. Se guardan por separado
     *       cuándo ocurrió (fechaHoraLlegada) y cuándo se informó (fechaHoraReporte), porque el recorrido pasa por zonas
     *       sin señal. Las etapas se informan en orden. El primer avance pone la salida EN_CURSO y completar la última
     *       etapa la deja FINALIZADA.
     *     tags: [Portal del guía]
     *     security:
     *       - BearerAuth: []
     *     parameters:
     *       - { in: path, name: idsalida, required: true, schema: { type: integer } }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [numeroOrden, estadoTramo, fechaHoraLlegada]
     *             properties:
     *               numeroOrden: { type: integer, example: 1, description: Etapa alcanzada (numeroOrden del itinerario). }
     *               estadoTramo: { type: string, enum: [COMPLETADO, DEMORADO] }
     *               fechaHoraLlegada: { type: string, format: date-time, example: "2026-12-10T14:35:00-05:00", description: Cuándo llegó realmente. No puede ser futura. }
     *     responses:
     *       201:
     *         description: Avance registrado.
     *         content:
     *           application/json:
     *             example:
     *               mensaje: Avance registrado correctamente
     *               data:
     *                 avance: { idavance: 1, numeroOrden: 1, estadoTramo: COMPLETADO, fechaHoraLlegada: "2026-12-10T19:35:00.000Z", fechaHoraReporte: "2026-12-10T22:02:11.000Z" }
     *                 salida: { idsalida: 2, estado: EN_CURSO, ultimaEtapaAlcanzada: 1 }
     *       400: { description: Datos inválidos, etapa de otro circuito, fuera de orden o ya completada, llegada futura o anterior a la etapa previa, o salida no activa. }
     *       403: { description: El guía no está asignado a esa salida. }
     *       404: { description: La salida no existe. }
     */
    router.post("/salidas/:idsalida/avances", controller.registrarAvance);

    return router;
  }
}
