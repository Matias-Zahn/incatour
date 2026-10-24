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
const RUTAS_PUBLICAS_PREFIJO = ["/auth/login", "/catalogo"];

function esPedidoPublico(ruta: string, metodo: string): boolean {
    if (RUTAS_PUBLICAS_PREFIJO.some((publica) => ruta.startsWith(publica))) {
        return true;
    }
    return ruta === "/clientes" && metodo.toUpperCase() === "POST";
}

/**
 * Cliente HTTP único: es el único lugar del front que usa fetch.
 * Con MSW activo las peticiones se interceptan; apuntando VITE_API_URL
 * al back real, el resto del código no cambia.
 *
 * - Agrega `Authorization: Bearer <token>` a cada pedido administrativo.
 * - Respeta headers explícitos pasados en opciones (e.g. checkout de cliente).
 * - Si el body es FormData, no fuerza Content-Type para permitir multipart boundary.
 * - Extrae mensajes de error de cuerpo.error o cuerpo.mensaje y los lanza como ErrorApi.
 * - Ante un 401 en llamadas autenticadas con la sesión de administración, limpia la sesión y redirige al login.
 */
export async function solicitarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
    const esFormData =
        typeof FormData !== "undefined" && opciones.body instanceof FormData;
    const cabecerasBase: HeadersInit = esFormData
        ? {}
        : { "Content-Type": "application/json" };

    const esRutaPublica = esPedidoPublico(ruta, opciones.method ?? "GET");

    const tieneAuthEnOpciones = (() => {
        if (!opciones.headers) return false;
        if (opciones.headers instanceof Headers) {
            return opciones.headers.has("Authorization");
        }
        if (Array.isArray(opciones.headers)) {
            return opciones.headers.some(([clave]) => clave.toLowerCase() === "authorization");
        }
        return Object.keys(opciones.headers).some((clave) => clave.toLowerCase() === "authorization");
    })();

    const token = obtenerToken();
    const cabeceraAuth: HeadersInit =
        token && !esRutaPublica && !tieneAuthEnOpciones
            ? { Authorization: `Bearer ${token}` }
            : {};

    const respuesta = await fetch(construirUrl(ruta), {
        ...opciones,
        headers: {
            ...cabecerasBase,
            ...cabeceraAuth,
            ...opciones.headers,
        },
    });

    if (!respuesta.ok) {
        if (respuesta.status === 401 && !esRutaPublica && !tieneAuthEnOpciones) {
            limpiarSesion();
            if (typeof window !== "undefined") {
                window.location.assign("/login");
            }
        }
        let mensaje = "Ocurrió un error inesperado.";
        try {
            const cuerpo = (await respuesta.json()) as { error?: string; mensaje?: string };
            if (cuerpo.error) {
                mensaje = cuerpo.error;
            } else if (cuerpo.mensaje) {
                mensaje = cuerpo.mensaje;
            }
        } catch {
            // respuesta sin cuerpo JSON
        }
        throw new ErrorApi(respuesta.status, mensaje);
    }

    if (respuesta.status === 204) {
        return undefined as T;
    }

    return (await respuesta.json()) as T;
}
