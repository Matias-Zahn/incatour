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

/**
 * Cliente HTTP único: es el único lugar del front que usa fetch.
 * Con MSW activo las peticiones se interceptan; apuntando VITE_API_URL
 * al back real, el resto del código no cambia.
 */
export async function solicitarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
    const esFormData =
        typeof FormData !== "undefined" && opciones.body instanceof FormData;
    const cabecerasBase: HeadersInit = esFormData
        ? {}
        : { "Content-Type": "application/json" };

    const respuesta = await fetch(construirUrl(ruta), {
        ...opciones,
        headers: { ...cabecerasBase, ...opciones.headers },
    });

    if (!respuesta.ok) {
        let mensaje = "Ocurrió un error inesperado.";
        try {
            const cuerpo = (await respuesta.json()) as { error?: string; mensaje?: string };
            if (cuerpo.error) mensaje = cuerpo.error;
            else if (cuerpo.mensaje) mensaje = cuerpo.mensaje;
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
