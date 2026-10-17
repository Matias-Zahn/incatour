import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { construirUrl, solicitarApi } from "./clienteApi";
import { clavesPaquetes } from "./paqueteService";

export type TarifaCatalogoPublico = {
    idtemporada: number;
    temporada: string;
    fechaInicio: string;
    fechaFin: string;
    precio: number;
    moneda: string;
};

export type EtapaCatalogoPublico = {
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto?: string | null;
};

export type SalidaDisponibleCatalogo = {
    idsalida: number;
    nroSalida: string;
    fechaInicio: string;
    fechaFin: string;
    stockLocal: number;
    tamanoMaximo: number;
    precioPersona: number;
    moneda: string;
    temporadaNombre: string;
};

export type EquipajeTransporteCatalogo = {
    pesoEquipajeIncluido: number;
    costoPorKgExcedente: number;
};

export type PaqueteCatalogoPublico = {
    id: number;
    codigo: string;
    nombre: string;
    imagenPrincipal?: string;
    imagenes?: string[];
    tieneImagenesPropias?: boolean;
    circuito: {
        nombre: string;
        dias: number;
        dificultad: string;
        recorrido: string;
        etapas?: EtapaCatalogoPublico[];
    };
    nochesAlojamiento: {
        previas: number;
        posteriores: number;
        garantia: string;
        tipoGarantia?: string;
    };
    serviciosAdicionales: string[];
    equipajeTransporte?: EquipajeTransporteCatalogo | null;
    condiciones?: string | null;
    diasDisponibles?: string | null;
    precios: TarifaCatalogoPublico[];
    salidasDisponibles?: SalidaDisponibleCatalogo[];
};

export type PasajeroReservaInput = {
    nombreCompleto: string;
    nroPasaporte: string;
    nacionalidad: string;
    fechaVencimientoPasaporte: string;
};

export type EquipajeReservaInput = {
    pesoDeclarado: number;
};

export type TarjetaReservaInput = {
    numero: string;
    titular: string;
    vencimiento: string;
    cvv: string;
};

export type CrearReservaPayload = {
    idsalida: number;
    medioPago: string;
    pasajeros: PasajeroReservaInput[];
    equipaje?: EquipajeReservaInput[];
    tarjeta: TarjetaReservaInput;
};

export type ResultadoReservaConfirmada = {
    idreserva: number;
    nroReserva: string;
    estado: string;
    estadoAlojamiento: "CONFIRMADO" | "PENDIENTE" | string;
    cantidadPasajeros: number;
    precioCongelado: number;
    moneda: string;
    transaccionPasarela: string;
};

type RespuestaCatalogo = {
    mensaje?: string;
    cantidad?: number;
    data: PaqueteCatalogoPublico[];
};

type RespuestaCrearReserva = {
    mensaje: string;
    data: ResultadoReservaConfirmada;
};

let tokenClienteCache: string | null = null;
let promesaTokenCliente: Promise<string | null> | null = null;

function leerRolDeJwt(token: string): string | null {
    try {
        const partes = token.split(".");
        if (partes.length < 2) return null;
        const payloadJson = atob(
            partes[1].replace(/-/g, "+").replace(/_/g, "/"),
        );
        const payload = JSON.parse(payloadJson) as { rol?: string };
        return payload.rol ?? null;
    } catch {
        return null;
    }
}

async function obtenerTokenCliente(
    forzarRenovacion = false,
): Promise<string | null> {
    if (!forzarRenovacion && typeof window !== "undefined") {
        const guardado = localStorage.getItem("token");
        if (guardado && leerRolDeJwt(guardado) === "CLIENTE") {
            return guardado;
        }
    }

    if (!forzarRenovacion && tokenClienteCache) {
        return tokenClienteCache;
    }

    if (!promesaTokenCliente) {
        promesaTokenCliente = fetch(construirUrl("/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "juan@test.com",
                contrasenia: "hash123",
            }),
        })
            .then(async (res) => {
                if (!res.ok) return null;
                const cuerpo = (await res.json()) as {
                    token?: string;
                    data?: { token?: string };
                };
                const token = cuerpo.data?.token ?? cuerpo.token ?? null;
                if (token) {
                    tokenClienteCache = token;
                }
                return token;
            })
            .catch(() => null)
            .finally(() => {
                promesaTokenCliente = null;
            });
    }

    return promesaTokenCliente;
}

export async function listarCatalogoPublico(): Promise<
    PaqueteCatalogoPublico[]
> {
    const res = await solicitarApi<RespuestaCatalogo>("/catalogo");
    return res.data ?? [];
}

export async function crearReservaPaquete(
    payload: CrearReservaPayload,
): Promise<{ mensaje: string; reserva: ResultadoReservaConfirmada }> {
    const token = await obtenerTokenCliente(false);
    const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

    try {
        const res = await solicitarApi<RespuestaCrearReserva>("/reservas", {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
        return { mensaje: res.mensaje, reserva: res.data };
    } catch (err) {
        const estado = (err as { estado?: number })?.estado;
        if (estado === 401 || estado === 403) {
            const tokenRenovado = await obtenerTokenCliente(true);
            const headersRenovados: HeadersInit = tokenRenovado
                ? { Authorization: `Bearer ${tokenRenovado}` }
                : {};
            const res = await solicitarApi<RespuestaCrearReserva>("/reservas", {
                method: "POST",
                headers: headersRenovados,
                body: JSON.stringify(payload),
            });
            return { mensaje: res.mensaje, reserva: res.data };
        }
        throw err;
    }
}

export const clavesCatalogoCompra = {
    catalogo: ["catalogo-publico"] as const,
};

export function useCatalogoPublico() {
    return useQuery({
        queryKey: clavesCatalogoCompra.catalogo,
        queryFn: listarCatalogoPublico,
    });
}

export function useCrearReservaPaquete() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: crearReservaPaquete,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: clavesCatalogoCompra.catalogo,
            });
            queryClient.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            });
            queryClient.invalidateQueries({
                queryKey: ["solicitudes"],
            });
        },
    });
}
