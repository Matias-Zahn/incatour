import { setupWorker } from "msw/browser";
import { manejadoresPersonal } from "./manejadores/personal";
import { manejadoresProveedores } from "./manejadores/proveedores";
import { manejadoresServicios } from "./manejadores/servicios";

// Registrá acá los manejadores de cada recurso nuevo.
export const manejadores = [
    ...manejadoresProveedores,
    ...manejadoresServicios,
    ...manejadoresPersonal,
];

export const trabajadorMocks = setupWorker(...manejadores);
