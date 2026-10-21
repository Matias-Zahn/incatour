import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { solicitarApi } from "./clienteApi";
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

// CU-26: Consultar catálogo público de paquetes turísticos
export async function listarCatalogoPublico(): Promise<
    PaqueteCatalogoPublico[]
> {
    const res = await solicitarApi<RespuestaCatalogo>("/catalogo");
    return res.data ?? [];
}

// CU-30: Comprar un paquete turístico (usa el token de sesionService a través de solicitarApi)
export async function crearReservaPaquete(
    payload: CrearReservaPayload,
): Promise<{ mensaje: string; reserva: ResultadoReservaConfirmada }> {
    const res = await solicitarApi<RespuestaCrearReserva>("/reservas", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return { mensaje: res.mensaje, reserva: res.data };
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
            queryClient.invalidateQueries({
                queryKey: ["cliente-mis-reservas"],
            });
            queryClient.invalidateQueries({
                queryKey: ["cliente-historial-resenias"],
            });
        },
    });
}
