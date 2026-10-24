import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";
import { clavesCatalogoCompra } from "./catalogoCompraService";
import {
    guardarSesion,
    limpiarSesion,
    obtenerToken,
    obtenerUsuario,
} from "./sesionService";

// ============================================================================
// CU-27: Registrarse como cliente (POST /api/clientes)
// ============================================================================

const soloLetrasYEspaciosRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;

export const esquemaRegistroCliente = z
    .object({
        nombre: z
            .string()
            .trim()
            .min(1, "El nombre es obligatorio.")
            .max(64, "El nombre debe tener entre 1 y 64 caracteres.")
            .regex(
                soloLetrasYEspaciosRegex,
                "El nombre solo puede contener letras y espacios.",
            ),
        apellido: z
            .string()
            .trim()
            .min(1, "El apellido es obligatorio.")
            .max(64, "El apellido debe tener entre 1 y 64 caracteres.")
            .regex(
                soloLetrasYEspaciosRegex,
                "El apellido solo puede contener letras y espacios.",
            ),
        email: z
            .string()
            .trim()
            .min(1, "El correo electrónico es obligatorio.")
            .email("El formato del correo electrónico no es válido."),
        contrasenia: z
            .string()
            .min(8, "La contraseña debe tener como mínimo 8 caracteres."),
        confirmarContrasenia: z
            .string()
            .min(1, "Confirmá tu contraseña."),
    })
    .refine((datos) => datos.contrasenia === datos.confirmarContrasenia, {
        path: ["confirmarContrasenia"],
        message: "Las contraseñas no coinciden.",
    });

export type DatosRegistroClienteForm = z.infer<typeof esquemaRegistroCliente>;

export type RegistrarClientePayload = {
    nombre: string;
    apellido: string;
    email: string;
    contrasenia: string;
};

export type ClienteRegistrado = {
    idcliente: number;
    idusuario: number;
    nroCliente: string;
    nombre: string;
    apellido: string;
    email: string;
    estado: string;
};

type RespuestaRegistrarCliente = {
    mensaje: string;
    data: ClienteRegistrado;
};

const CLAVE_IDCLIENTE = "incatour.idcliente";

export function guardarIdClienteLocal(idcliente: number): void {
    try {
        localStorage.setItem(CLAVE_IDCLIENTE, String(idcliente));
    } catch {
        // Ignorar errores de almacenamiento
    }
}

export function obtenerIdClienteLocal(): number | null {
    try {
        const valor = localStorage.getItem(CLAVE_IDCLIENTE);
        if (!valor) return null;
        const numero = Number(valor);
        return Number.isInteger(numero) && numero > 0 ? numero : null;
    } catch {
        return null;
    }
}

export async function registrarCliente(
    payload: RegistrarClientePayload,
): Promise<RespuestaRegistrarCliente> {
    const respuesta = await solicitarApi<RespuestaRegistrarCliente>("/clientes", {
        method: "POST",
        body: JSON.stringify({
            nombre: payload.nombre.trim(),
            apellido: payload.apellido.trim(),
            email: payload.email.trim().toLowerCase(),
            contrasenia: payload.contrasenia,
        }),
    });
    if (respuesta.data?.idcliente) {
        guardarIdClienteLocal(respuesta.data.idcliente);
    }
    return respuesta;
}

export function useRegistrarCliente() {
    return useMutation({
        mutationFn: registrarCliente,
    });
}

// ============================================================================
// CU-28: Modificar cuenta de cliente (GET /api/clientes/:id y PUT /api/clientes/:id)
// CU-29: Baja cuenta de cliente (PATCH /api/clientes/:id/baja)
// ============================================================================

export type PerfilClienteDetalle = {
    idcliente: number;
    idusuario: number;
    nroCliente: string;
    estado: string;
    usuario: {
        nombre: string;
        apellido: string;
        email: string;
    };
};

export const esquemaModificarCliente = z.object({
    nombre: z
        .string()
        .trim()
        .min(1, "El nombre debe tener entre 1 y 64 caracteres.")
        .max(64, "El nombre debe tener entre 1 y 64 caracteres.")
        .regex(
            soloLetrasYEspaciosRegex,
            "El nombre solo puede contener letras y espacios.",
        ),
    apellido: z
        .string()
        .trim()
        .min(1, "El apellido debe tener entre 1 y 64 caracteres.")
        .max(64, "El apellido debe tener entre 1 y 64 caracteres.")
        .regex(
            soloLetrasYEspaciosRegex,
            "El apellido solo puede contener letras y espacios.",
        ),
    email: z
        .string()
        .trim()
        .min(1, "El correo electrónico es obligatorio.")
        .email("El formato del correo electrónico no es válido."),
});

export type DatosModificarClienteForm = z.infer<typeof esquemaModificarCliente>;

export type ModificarClientePayload = {
    idcliente: number;
    nombre: string;
    apellido: string;
    email: string;
};

export async function consultarPerfilClienteActual(): Promise<PerfilClienteDetalle> {
    const res = await solicitarApi<{ data: PerfilClienteDetalle }>(
        "/clientes/mi-perfil",
    );
    if (res.data?.idcliente) {
        guardarIdClienteLocal(res.data.idcliente);
    }
    return res.data;
}

export async function modificarCuentaCliente(
    payload: ModificarClientePayload,
): Promise<{ mensaje: string; data: PerfilClienteDetalle }> {
    const respuesta = await solicitarApi<{
        mensaje: string;
        data: PerfilClienteDetalle;
    }>(`/clientes/${payload.idcliente}`, {
        method: "PUT",
        body: JSON.stringify({
            nombre: payload.nombre.trim(),
            apellido: payload.apellido.trim(),
            email: payload.email.trim().toLowerCase(),
        }),
    });

    // Sincronizar los datos del usuario en la sesión activa
    const token = obtenerToken();
    const usuarioActual = obtenerUsuario();
    if (token && usuarioActual && respuesta.data?.usuario) {
        guardarSesion(token, {
            ...usuarioActual,
            nombre: respuesta.data.usuario.nombre,
            apellido: respuesta.data.usuario.apellido,
            email: respuesta.data.usuario.email,
        });
    }

    return respuesta;
}

export async function darDeBajaCuentaCliente(
    idcliente: number,
): Promise<{
    mensaje: string;
    data: { idcliente: number; estado: string };
}> {
    const respuesta = await solicitarApi<{
        mensaje: string;
        data: { idcliente: number; estado: string };
    }>(`/clientes/${idcliente}/baja`, {
        method: "PATCH",
    });
    limpiarSesion();
    return respuesta;
}

// ============================================================================
// CU-31: Consultar reservas (GET /api/reservas/mis-reservas, /:idreserva, /:idreserva/comprobante)
// ============================================================================

export type EstadoReservaCliente = "CONFIRMADA" | "CANCELADA";

export type ReservaClienteResumen = {
    idreserva: number;
    nroReserva: string;
    estado: string;
    estadoAlojamiento: string;
    fechaRealizacion: string;
    cantidadPasajeros: number;
    precioCongelado: number;
    pagado: number;
    reintegro: number | null;
    salida: {
        idsalida: number;
        nroSalida: string;
        estado: string;
        fechaInicio: string;
        fechaFin: string;
    };
    paquete: {
        idpaquete: number;
        nombrePaquete: string;
    };
};

export type EtapaItinerarioReserva = {
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto: string | null;
};

export type PasajeroReservaDetalle = {
    idpasajero: number;
    nombreCompleto: string;
    nroPasaporte: string;
    nacionalidad: string;
};

export type PagoReservaDetalle = {
    idpago?: number;
    nrotransaccion: string;
    monto: number;
    medioPago: string;
    fechahora: string;
};

export type ReembolsoReservaDetalle = {
    idreembolso: number;
    montoReembolsado: number;
    motivo: string;
    fechaReembolso: string;
};

export type SolicitudAlojamientoReservaDetalle = {
    nroSolicitud: string;
    estado: string;
    cantidadPlazas: number;
};

export type PermisoReservaDetalle = {
    idpasajero: number;
    nroPermiso: string;
    estadoTramite: string;
    fechaEmision: string;
};

export type ReservaClienteDetalle = {
    idreserva: number;
    nroReserva: string;
    estado: string;
    estadoAlojamiento: string;
    fechaRealizacion: string;
    cantidadPasajeros: number;
    precioCongelado: number;
    condicionesComerciales: string | null;
    pagado: number;
    titular: {
        nombre: string;
        apellido: string;
        email: string;
    };
    salida: {
        idsalida: number;
        nroSalida: string;
        estado: string;
        fechaInicio: string;
        fechaFin: string;
    };
    paquete: {
        idpaquete: number;
        nombrePaquete: string;
    };
    itinerario: {
        nombreCircuito: string;
        duracionDias: number;
        etapas: EtapaItinerarioReserva[];
    };
    pasajeros: PasajeroReservaDetalle[];
    pagos: PagoReservaDetalle[];
    reembolsos: ReembolsoReservaDetalle[];
    solicitudesAlojamiento: SolicitudAlojamientoReservaDetalle[];
    permisos: PermisoReservaDetalle[];
};

export type ComprobanteReserva = {
    nroReserva: string;
    fechaRealizacion: string;
    estado: string;
    titular: {
        nombre: string;
        apellido: string;
        email: string;
    };
    paquete: string;
    salida: {
        nroSalida: string;
        fechaInicio: string;
        fechaFin: string;
    };
    pasajeros: string[];
    precioCongelado: number;
    condicionesComerciales: string | null;
    pagos: Array<{
        nroTransaccion: string;
        monto: number;
        medioPago: string;
        fechahora: string;
    }>;
    totalPagado: number;
    reintegro: number | null;
};

export async function listarMisReservas(
    estado?: EstadoReservaCliente,
): Promise<ReservaClienteResumen[]> {
    const query = estado ? `?estado=${encodeURIComponent(estado)}` : "";
    const res = await solicitarApi<{ data: ReservaClienteResumen[] }>(
        `/reservas/mis-reservas${query}`,
    );
    return res.data ?? [];
}

export async function obtenerDetalleMiReserva(
    idreserva: number,
): Promise<ReservaClienteDetalle> {
    const res = await solicitarApi<{ data: ReservaClienteDetalle }>(
        `/reservas/${idreserva}`,
    );
    return res.data;
}

export async function obtenerComprobanteMiReserva(
    idreserva: number,
): Promise<ComprobanteReserva> {
    const res = await solicitarApi<{ data: ComprobanteReserva }>(
        `/reservas/${idreserva}/comprobante`,
    );
    return res.data;
}

// ============================================================================
// CU-32: Cancelar reserva (GET /api/reservas/:idreserva/cancelacion y POST /api/reservas/:idreserva/cancelar)
// ============================================================================

export type ResumenCancelacionReserva = {
    idreserva: number;
    nroReserva: string;
    importeAbonado: number;
    montoAReintegrar: number;
    permisosEmitidos: boolean;
    lugaresVuelvenALaVenta: boolean;
    advertencia: string | null;
};

export type ResultadoCancelacionReserva = {
    idreserva: number;
    nroReserva: string;
    estado: string;
    lugaresVuelvenALaVenta: boolean;
    reembolso: {
        idreembolso: number;
        montoReembolsado: number;
        motivo: string;
        fechaReembolso: string;
        nota: string;
    };
};

export const esquemaCancelarReserva = z.object({
    motivo: z
        .string()
        .trim()
        .max(300, "El motivo debe tener hasta 300 caracteres.")
        .optional(),
});

export type DatosCancelarReservaForm = z.infer<typeof esquemaCancelarReserva>;

export async function consultarLiquidacionCancelacion(
    idreserva: number,
): Promise<ResumenCancelacionReserva> {
    const res = await solicitarApi<{ data: ResumenCancelacionReserva }>(
        `/reservas/${idreserva}/cancelacion`,
    );
    return res.data;
}

export async function confirmarCancelacionReserva(params: {
    idreserva: number;
    motivo?: string;
}): Promise<{ mensaje: string; data: ResultadoCancelacionReserva }> {
    const motivoLimpio = params.motivo?.trim();
    return solicitarApi<{ mensaje: string; data: ResultadoCancelacionReserva }>(
        `/reservas/${params.idreserva}/cancelar`,
        {
            method: "POST",
            body: JSON.stringify(
                motivoLimpio ? { motivo: motivoLimpio } : {},
            ),
        },
    );
}

// ============================================================================
// CU-47: Publicar reseña (GET /api/resenias/historial-reservas y POST /api/resenias)
// ============================================================================

export type ReseniaCliente = {
    idcliente: number;
    idsalida: number;
    valoracion: number;
    comentario: string | null;
    fechaEnvio: string;
};

export type ItemHistorialResenia = {
    idreserva: number;
    nroReserva: string;
    estadoReserva: string;
    puedeResenar: boolean;
    resenia: ReseniaCliente | null;
    salida: {
        idsalida: number;
        nroSalida: string;
        estado: string;
        fechaInicio: string;
        fechaFin: string;
        paquete: {
            idpaquete: number;
            nombrePaquete: string;
        };
    };
};

export const esquemaPublicarResenia = z.object({
    idsalida: z.number().int().positive("Seleccioná una salida válida."),
    valoracion: z
        .number({ message: "La valoración debe ser un número entero entre 1 y 5." })
        .int("La valoración debe ser un número entero entre 1 y 5.")
        .min(1, "La valoración mínima es 1 estrella.")
        .max(5, "La valoración máxima es 5 estrellas."),
    comentario: z
        .string()
        .trim()
        .max(1000, "El comentario no puede superar los 1000 caracteres.")
        .optional(),
});

export type DatosPublicarReseniaForm = z.infer<typeof esquemaPublicarResenia>;

export type PublicarReseniaPayload = {
    idsalida: number;
    valoracion: number;
    comentario?: string | null;
};

export async function consultarHistorialReservasResenia(): Promise<
    ItemHistorialResenia[]
> {
    const res = await solicitarApi<{ data: ItemHistorialResenia[] }>(
        "/resenias/historial-reservas",
    );
    return res.data ?? [];
}

export async function publicarReseniaCliente(
    payload: PublicarReseniaPayload,
): Promise<{ mensaje: string; data: ReseniaCliente }> {
    const comentarioLimpio = payload.comentario?.trim();
    return solicitarApi<{ mensaje: string; data: ReseniaCliente }>("/resenias", {
        method: "POST",
        body: JSON.stringify({
            idsalida: payload.idsalida,
            valoracion: payload.valoracion,
            ...(comentarioLimpio ? { comentario: comentarioLimpio } : {}),
        }),
    });
}

// ============================================================================
// Claves de React Query y Hooks
// ============================================================================

export const clavesPortalCliente = {
    perfilCliente: ["cliente-perfil-actual"] as const,
    misReservas: (estado?: EstadoReservaCliente) =>
        ["cliente-mis-reservas", estado ?? "TODAS"] as const,
    detalleReserva: (idreserva: number | null) =>
        ["cliente-detalle-reserva", idreserva] as const,
    liquidacionCancelacion: (idreserva: number | null) =>
        ["cliente-liquidacion-cancelacion", idreserva] as const,
    historialResenias: ["cliente-historial-resenias"] as const,
};

export function usePerfilClienteActual(habilitado = true) {
    return useQuery({
        queryKey: clavesPortalCliente.perfilCliente,
        queryFn: consultarPerfilClienteActual,
        enabled: habilitado,
    });
}

export function useModificarCuentaCliente() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: modificarCuentaCliente,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: clavesPortalCliente.perfilCliente,
            });
            queryClient.invalidateQueries({
                queryKey: ["cliente-mis-reservas"],
            });
        },
    });
}

export function useDarDeBajaCuentaCliente() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaCuentaCliente,
        onSuccess: () => {
            queryClient.clear();
        },
    });
}

export function useMisReservas(estado?: EstadoReservaCliente, habilitado = true) {
    return useQuery({
        queryKey: clavesPortalCliente.misReservas(estado),
        queryFn: () => listarMisReservas(estado),
        enabled: habilitado,
    });
}

export function useDetalleMiReserva(idreserva: number | null) {
    return useQuery({
        queryKey: clavesPortalCliente.detalleReserva(idreserva),
        queryFn: () => obtenerDetalleMiReserva(idreserva!),
        enabled: idreserva !== null && idreserva > 0,
    });
}

export function useLiquidacionCancelacion(idreserva: number | null) {
    return useQuery({
        queryKey: clavesPortalCliente.liquidacionCancelacion(idreserva),
        queryFn: () => consultarLiquidacionCancelacion(idreserva!),
        enabled: idreserva !== null && idreserva > 0,
        retry: false,
    });
}

export function useConfirmarCancelacionReserva() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: confirmarCancelacionReserva,
        onSuccess: (_res, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["cliente-mis-reservas"],
            });
            queryClient.invalidateQueries({
                queryKey: clavesPortalCliente.detalleReserva(variables.idreserva),
            });
            queryClient.invalidateQueries({
                queryKey: clavesPortalCliente.historialResenias,
            });
            queryClient.invalidateQueries({
                queryKey: clavesCatalogoCompra.catalogo,
            });
            queryClient.invalidateQueries({
                queryKey: ["solicitudes"],
            });
        },
    });
}

export function useHistorialReservasResenia(habilitado = true) {
    return useQuery({
        queryKey: clavesPortalCliente.historialResenias,
        queryFn: consultarHistorialReservasResenia,
        enabled: habilitado,
    });
}

export function usePublicarReseniaCliente() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: publicarReseniaCliente,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: clavesPortalCliente.historialResenias,
            });
            queryClient.invalidateQueries({
                queryKey: ["cliente-mis-reservas"],
            });
            queryClient.invalidateQueries({
                queryKey: ["resenias"],
            });
        },
    });
}

// ============================================================================
// Utilidades de formato para las pantallas del cliente
// ============================================================================

export function formatearFechaUtcCorta(iso?: string | null): string {
    if (!iso) return "--/--/----";
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

export function formatearRangoFechasUtc(
    fechaInicioIso?: string | null,
    fechaFinIso?: string | null,
): string {
    const inicio = formatearFechaUtcCorta(fechaInicioIso);
    const fin = formatearFechaUtcCorta(fechaFinIso);
    return `${inicio} – ${fin}`;
}

export function formatearMontoUsd(monto?: number | null): string {
    if (monto === null || monto === undefined || Number.isNaN(Number(monto))) {
        return "USD 0.00";
    }
    return `USD ${Number(monto).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function etiquetaEstadoReserva(estado?: string | null): string {
    switch (estado?.trim().toUpperCase()) {
        case "CONFIRMADA":
            return "Confirmada";
        case "CANCELADA":
            return "Cancelada";
        default:
            return estado ?? "Sin estado";
    }
}

export function estilosEstadoReserva(estado?: string | null): string {
    switch (estado?.trim().toUpperCase()) {
        case "CONFIRMADA":
            return "bg-[#e0f4e8] text-[#216442]";
        case "CANCELADA":
            return "bg-[#fce5e6] text-[#a23a45]";
        default:
            return "bg-[#fff1d3] text-[#835916]";
    }
}

export function etiquetaEstadoSalidaCliente(estado?: string | null): string {
    switch (estado?.trim().toUpperCase()) {
        case "PUBLICADA":
            return "Publicada";
        case "EN_CURSO":
            return "En curso";
        case "FINALIZADA":
            return "Finalizada";
        case "CANCELADA":
            return "Cancelada";
        default:
            return estado ?? "Sin estado";
    }
}

export function reservaAdmiteCancelacion(reserva: {
    estado: string;
    salida: { estado: string; fechaInicio: string };
}): boolean {
    if (reserva.estado?.toUpperCase() !== "CONFIRMADA") return false;
    const estadoSalida = reserva.salida.estado?.toUpperCase();
    if (["EN_CURSO", "FINALIZADA", "CANCELADA"].includes(estadoSalida)) {
        return false;
    }
    const fechaInicio = new Date(reserva.salida.fechaInicio);
    if (!Number.isNaN(fechaInicio.getTime()) && fechaInicio <= new Date()) {
        return false;
    }
    return true;
}

export function generarTextoComprobanteDescargable(
    comprobante: ComprobanteReserva,
): string {
    const lineas: string[] = [
        "============================================================",
        "               INCATOUR - COMPROBANTE DE RESERVA            ",
        "============================================================",
        `N° Reserva:          ${comprobante.nroReserva}`,
        `Estado:              ${etiquetaEstadoReserva(comprobante.estado)}`,
        `Fecha de emisión:    ${formatearFechaUtcCorta(comprobante.fechaRealizacion)}`,
        "",
        "--- TITULAR DE LA RESERVA ---",
        `Nombre:              ${comprobante.titular.nombre} ${comprobante.titular.apellido}`,
        `Correo electrónico:  ${comprobante.titular.email}`,
        "",
        "--- RECORRIDO Y SALIDA ---",
        `Paquete turístico:   ${comprobante.paquete}`,
        `N° de Salida:        ${comprobante.salida.nroSalida}`,
        `Fecha de inicio:     ${formatearFechaUtcCorta(comprobante.salida.fechaInicio)}`,
        `Fecha de fin:        ${formatearFechaUtcCorta(comprobante.salida.fechaFin)}`,
    ];

    if (comprobante.condicionesComerciales) {
        lineas.push(`Condiciones:         ${comprobante.condicionesComerciales}`);
    }

    lineas.push(
        "",
        `--- PASAJEROS (${comprobante.pasajeros.length}) ---`,
        ...(comprobante.pasajeros.length > 0
            ? comprobante.pasajeros.map((nombre, i) => `  ${i + 1}. ${nombre}`)
            : ["  Sin pasajeros detallados"]),
        "",
        "--- SITUACIÓN DE PAGO ---",
        `Precio congelado:    ${formatearMontoUsd(comprobante.precioCongelado)}`,
        `Total abonado:       ${formatearMontoUsd(comprobante.totalPagado)}`,
    );

    if (comprobante.reintegro !== null) {
        lineas.push(
            `Reintegro registrado:${formatearMontoUsd(comprobante.reintegro)}`,
        );
    }

    if (comprobante.pagos.length > 0) {
        lineas.push("", "--- DETALLE DE TRANSACCIONES ---");
        for (const p of comprobante.pagos) {
            lineas.push(
                `  • ${p.nroTransaccion} | ${p.medioPago} | ${formatearMontoUsd(p.monto)} | ${formatearFechaUtcCorta(p.fechahora)}`,
            );
        }
    }

    lineas.push("============================================================");
    return lineas.join("\n");
}
