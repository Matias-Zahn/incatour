import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { solicitarApi } from "./clienteApi";

export type EstadoCuentaGuia = "ACTIVO" | "INACTIVO";
export type SituacionHabilitacion = "VIGENTE" | "VENCIDA" | "SIN_DATOS";

export type FiltrosCuentaGuia = {
    rol?: "GUIA";
    estado?: EstadoCuentaGuia;
    habilitacion?: "VIGENTE" | "VENCIDA";
    busqueda?: string;
};

export type CuentaGuia = {
    idusuario: number;
    id: number;
    email: string;
    nombre: string;
    apellido: string;
    rol: "GUIA";
    estado: EstadoCuentaGuia;
    creadoEn: string;
    guia: {
        idpersonal: number;
        nombreCompleto: string;
        nroPasaporte: string;
        estadoPersonal: EstadoCuentaGuia;
    };
    habilitacion: {
        nroHabilitacion: string | null;
        fechaHabilitacion: string | null;
        situacion: SituacionHabilitacion;
    };
    salidasPendientes: number;
    puedeDarseDeBaja: boolean;
};

type CuentaGuiaApi = Omit<CuentaGuia, "id">;
type Respuesta<T> = { data: T };

const extraer = <T,>(respuesta: Respuesta<T>): T => respuesta.data;

export function normalizarCuentaGuia(cuenta: CuentaGuiaApi): CuentaGuia {
    return {
        ...cuenta,
        id: cuenta.idusuario,
    };
}

function construirQueryCuentasGuia(filtros: FiltrosCuentaGuia = {}): string {
    const parametros = new URLSearchParams();
    if (filtros.rol) parametros.set("rol", filtros.rol);
    if (filtros.estado) parametros.set("estado", filtros.estado);
    if (filtros.habilitacion) parametros.set("habilitacion", filtros.habilitacion);
    if (filtros.busqueda?.trim()) parametros.set("busqueda", filtros.busqueda.trim());
    const query = parametros.toString();
    return query ? `?${query}` : "";
}

export function consultarUsuariosGuia(filtros: FiltrosCuentaGuia = {}): Promise<CuentaGuia[]> {
    return solicitarApi<Respuesta<CuentaGuiaApi[]>>(
        `/cuentas-guia${construirQueryCuentasGuia(filtros)}`,
    )
        .then(extraer)
        .then((datos) => datos.map(normalizarCuentaGuia));
}

export const listarCuentasGuia = consultarUsuariosGuia;

export function darDeBajaCuenta(idusuario: number): Promise<CuentaGuia> {
    return solicitarApi<Respuesta<CuentaGuiaApi>>(`/cuentas-guia/${idusuario}/baja`, {
        method: "PATCH",
    })
        .then(extraer)
        .then(normalizarCuentaGuia);
}

export const darDeBajaCuentaGuia = darDeBajaCuenta;

export const clavesCuentasGuia = {
    todas: ["cuentas-guia"] as const,
    lista: (filtros?: FiltrosCuentaGuia) => ["cuentas-guia", filtros ?? {}] as const,
};

export function useCuentasGuia(filtros?: FiltrosCuentaGuia) {
    return useQuery({
        queryKey: clavesCuentasGuia.lista(filtros),
        queryFn: () => consultarUsuariosGuia(filtros),
    });
}

export function useDarDeBajaCuenta() {
    const consultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaCuenta,
        onSuccess: () => {
            consultas.invalidateQueries({ queryKey: clavesCuentasGuia.todas });
            consultas.invalidateQueries({ queryKey: ["personal"] });
        },
    });
}

export const useDarDeBajaCuentaGuia = useDarDeBajaCuenta;
