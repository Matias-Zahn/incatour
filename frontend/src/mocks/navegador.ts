import { setupWorker } from "msw/browser";
import { manejadoresProveedores } from "./manejadores/proveedores";

// Registrá acá los manejadores de cada recurso nuevo.
export const manejadores = [...manejadoresProveedores];

export const trabajadorMocks = setupWorker(...manejadores);
