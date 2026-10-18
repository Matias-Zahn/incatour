import { limpiarSesion, obtenerToken } from "./sesionService";

const URL_BASE: string = import.meta.env.VITE_API_URL ?? "/api";

export class ErrorApi extends Error {
    readonly estado: number;

    constructor(estado: number, mensaje: string) {
        super(mensaje);
        this.name = "ErrorApi";
        this.estado = estado;
    }
}

/** Arma la URL completa de un recurso. La usan también los mocks de MSW. */
export function construirUrl(ruta: string): string {
    return `${URL_BASE}${ruta}`;
}

/** Rutas públicas: no llevan token y un 401 no implica sesión vencida. */
const RUTAS_PUBLICAS = ["/auth/login"];

/**
 * Cliente HTTP único: es el único lugar del front que usa fetch.
 * Con MSW activo las peticiones se interceptan; apuntando VITE_API_URL
 * al back real, el resto del código no cambia.
 *
 * - Agrega `Authorization: Bearer <token>` a cada pedido.
 * - Los errores vienen como `{ error }` y se lanzan como ErrorApi.
 * - Ante un 401 borra la sesión y vuelve al login.
 */
export async function solicitarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
    const esPublica = RUTAS_PUBLICAS.some((publica) => ruta.startsWith(publica));
    const token = obtenerToken();
    const respuesta = await fetch(construirUrl(ruta), {
        ...opciones,
        headers: {
            "Content-Type": "application/json",
            ...(token && !esPublica ? { Authorization: `Bearer ${token}` } : {}),
            ...opciones.headers,
        },
    });

    if (!respuesta.ok) {
        if (respuesta.status === 401 && !esPublica) {
            limpiarSesion();
            if (window.location.pathname !== "/login") {
                window.location.assign("/login");
            }
        }
        const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
        throw new ErrorApi(respuesta.status, cuerpo.error ?? "Ocurrió un error inesperado.");
    }

    if (respuesta.status === 204) {
        return undefined as T;
    }

    return (await respuesta.json()) as T;
}
