import { setupWorker } from "msw/browser";
import { manejadoresCatalogoReservas } from "./manejadores/catalogoReservas";
import { manejadoresCircuitos } from "./manejadores/circuitos";
import { manejadoresEvaluaciones } from "./manejadores/evaluaciones";
import { manejadoresPaquetes } from "./manejadores/paquetes";
import { manejadoresProveedores } from "./manejadores/proveedores";
import { manejadoresSolicitudes } from "./manejadores/solicitudes";
import { manejadoresTemporadas } from "./manejadores/temporadas";

// Registrá acá los manejadores de cada recurso nuevo.
export const manejadores = [
    ...manejadoresProveedores,
    ...manejadoresCircuitos,
    ...manejadoresTemporadas,
    ...manejadoresPaquetes,
    ...manejadoresSolicitudes,
    ...manejadoresEvaluaciones,
    ...manejadoresCatalogoReservas,
];

export const trabajadorMocks = setupWorker(...manejadores);
