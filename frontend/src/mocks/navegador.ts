import { setupWorker } from "msw/browser";
import { manejadoresProveedores } from "./manejadores/proveedores";
import { manejadoresServicios } from "./manejadores/servicios";

// Registrá acá los manejadores de cada recurso nuevo.
export const manejadores = [...manejadoresProveedores, ...manejadoresServicios];

export const trabajadorMocks = setupWorker(...manejadores);
