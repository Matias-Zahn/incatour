import { setupWorker } from "msw/browser";
import { manejadoresAutenticacion } from "./manejadores/autenticacion";
import { manejadoresCatalogoReservas } from "./manejadores/catalogoReservas";
import { manejadoresCircuitos } from "./manejadores/circuitos";
import { manejadoresEtapas } from "./manejadores/etapas";
import { manejadoresEvaluaciones } from "./manejadores/evaluaciones";
import { manejadoresGuia } from "./manejadores/guia";
import { manejadoresIncidentes } from "./manejadores/incidentes";
import { manejadoresPaquetes } from "./manejadores/paquetes";
import { manejadoresPersonal } from "./manejadores/personal";
import { manejadoresProveedores } from "./manejadores/proveedores";
import { manejadoresSalidas } from "./manejadores/salidas";
import { manejadoresServicios } from "./manejadores/servicios";
import { manejadoresSolicitudes } from "./manejadores/solicitudes";
import { manejadoresTemporadas } from "./manejadores/temporadas";

// Registrá acá los manejadores de cada recurso nuevo.
export const manejadores = [
    ...manejadoresAutenticacion,
    ...manejadoresProveedores,
    ...manejadoresServicios,
    ...manejadoresPersonal,
    ...manejadoresCircuitos,
    ...manejadoresEtapas,
    ...manejadoresTemporadas,
    ...manejadoresPaquetes,
    ...manejadoresSalidas,
    ...manejadoresSolicitudes,
    ...manejadoresEvaluaciones,
    ...manejadoresCatalogoReservas,
    ...manejadoresGuia,
    ...manejadoresIncidentes,
];

export const trabajadorMocks = setupWorker(...manejadores);
