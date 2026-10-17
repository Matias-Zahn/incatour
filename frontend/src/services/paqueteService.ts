import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { construirUrl, solicitarApi } from "./clienteApi";
import type { Circuito } from "./circuitoService";
import type { Temporada } from "./temporadaService";

export type TipoGarantiaPaquete = "POR_ESTABLECIMIENTO" | "POR_CATEGORIA";

export const DIAS_SEMANA = [
    { codigo: "L", corto: "Lun", nombre: "Lunes" },
    { codigo: "M", corto: "Mar", nombre: "Martes" },
    { codigo: "X", corto: "Mié", nombre: "Miércoles" },
    { codigo: "J", corto: "Jue", nombre: "Jueves" },
    { codigo: "V", corto: "Vie", nombre: "Viernes" },
    { codigo: "S", corto: "Sáb", nombre: "Sábado" },
    { codigo: "D", corto: "Dom", nombre: "Domingo" },
] as const;

export type CodigoDia = (typeof DIAS_SEMANA)[number]["codigo"];

export const TODOS_LOS_DIAS: CodigoDia[] = ["L", "M", "X", "J", "V", "S", "D"];
export const DIAS_HABILES: CodigoDia[] = ["L", "M", "X", "J", "V"];
export const FIN_DE_SEMANA: CodigoDia[] = ["S", "D"];

export function parsearDiasDisponibles(cadena?: string | null): CodigoDia[] {
    if (!cadena) return [...TODOS_LOS_DIAS];
    const partes = cadena
        .toUpperCase()
        .split(/[-,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const validos = DIAS_SEMANA.map((d) => d.codigo).filter((cod) =>
        partes.includes(cod),
    );
    return validos.length > 0 ? validos : [...TODOS_LOS_DIAS];
}

export function serializarDiasDisponibles(dias: CodigoDia[]): string {
    return DIAS_SEMANA.map((d) => d.codigo)
        .filter((cod) => dias.includes(cod))
        .join("-");
}

export function formatearDiasLegibles(cadena?: string | null): string {
    if (!cadena) return "";
    const codigos = parsearDiasDisponibles(cadena);
    if (codigos.length === 7) return "Todos los días";
    if (
        codigos.length === 5 &&
        DIAS_HABILES.every((d) => codigos.includes(d))
    ) {
        return "Lun a Vie";
    }
    if (
        codigos.length === 2 &&
        FIN_DE_SEMANA.every((d) => codigos.includes(d))
    ) {
        return "Sáb y Dom";
    }
    return DIAS_SEMANA.filter((d) => codigos.includes(d.codigo))
        .map((d) => d.corto)
        .join(", ");
}

export type PrecioTemporadaInput = {
    idtemporada: number;
    monto: number;
    moneda: string;
};

export type TarifaPaquete = {
    idpaquete: number;
    idtemporada: number;
    monto: number;
    moneda: string;
    temporada?: Omit<Temporada, "id">;
};

export type ServicioDisponiblePaquete = {
    idservicio: number;
    tipo: "ALOJAMIENTO" | "TRANSPORTE" | "TREN" | "EQUIPAMIENTO";
    nombreServicio: string;
    descripcion?: string | null;
    costoBase: number;
    localidad?: string | null;
    estado: "ACTIVO" | "INACTIVO";
    proveedor?: {
        idproveedor: number;
        razonSocial: string;
        tipoProveedor: string;
    };
    datos?: {
        categoria?: string;
        tipoHabitacion?: string;
        capacidadDisponible?: number;
        modalidadConfirmacion?: "BLOQUEO_PLAZAS" | "A_SOLICITUD" | string;
        capacidadVehiculo?: number;
        horarioSalida?: string;
        horarioLlegada?: string;
        tipoEquipamiento?: string;
    };
    disponibilidad?: {
        capacidadDisponible?: number;
        modalidadConfirmacion?: string;
    };
};

export type Paquete = {
    id: number;
    idpaquete: number;
    idcircuito: number;
    nroPaquete: string;
    nombrePaquete: string;
    condiciones?: string | null;
    estado: "ACTIVO" | "INACTIVO";
    tipoGarantia: string;
    localidadGarantizada?: string | null;
    categoriaGarantizada?: string | null;
    tipoHabitacionGarantizada?: string | null;
    nochesPrevias: number;
    nochesPosteriores: number;
    diasDisponibles?: string | null;
    circuito?: Omit<Circuito, "id">;
    tarifas?: TarifaPaquete[];
    servicios?: {
        idpaquete: number;
        idservicio: number;
        servicio?: {
            idservicio: number;
            nombreServicio: string;
            localidad?: string | null;
            costoBase: number;
        };
    }[];
    garantiasEstablecimiento?: {
        idpaquete: number;
        idservicio: number;
        servicio?: {
            idservicio: number;
            nombreServicio: string;
            localidad?: string | null;
            alojamiento?: {
                categoria: string;
                tipoHabitacion: string;
                modalidadConfirmacion: string;
            } | null;
        };
    }[];
};

export type DatosCrearPaquete = {
    idcircuito: number;
    nombrePaquete: string;
    condiciones?: string;
    tipoGarantia: TipoGarantiaPaquete;
    idservicioGarantizado?: number;
    localidadGarantizada?: string;
    categoriaGarantizada?: string;
    tipoHabitacionGarantizada?: string;
    nochesPrevias: number;
    nochesPosteriores: number;
    diasDisponibles?: string;
    matrizPrecios: PrecioTemporadaInput[];
    serviciosIncluidos: number[];
};

export type DatosModificarPaquete = {
    nombrePaquete?: string;
    condiciones?: string;
    nochesPrevias?: number;
    nochesPosteriores?: number;
    diasDisponibles?: string;
    matrizPrecios?: PrecioTemporadaInput[];
};

type PaqueteApi = Omit<Paquete, "id">;

type RespuestaDatos<T> = {
    mensaje?: string;
    data: T;
};

let promesaTokenDev: Promise<string | null> | null = null;

function esTokenAdminVigente(token: string): boolean {
    try {
        const partes = token.split(".");
        if (partes.length !== 3 || !partes[1]) return false;
        const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64)) as {
            exp?: number;
            rol?: string;
        };
        if (payload.exp && payload.exp * 1000 <= Date.now() + 30_000) {
            return false;
        }
        if (payload.rol && payload.rol !== "ADMIN") {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

async function obtenerTokenAutenticado(forzarRenovacion = false): Promise<string | null> {
    if (typeof window !== "undefined") {
        if (forzarRenovacion) {
            localStorage.removeItem("token");
        } else {
            const guardado = localStorage.getItem("token");
            if (guardado && esTokenAdminVigente(guardado)) {
                return guardado;
            }
            if (guardado) {
                localStorage.removeItem("token");
            }
        }
    }
    if (import.meta.env.VITE_DEV_TOKEN) {
        return import.meta.env.VITE_DEV_TOKEN as string;
    }
    if (!import.meta.env.DEV) {
        return null;
    }
    if (!promesaTokenDev) {
        promesaTokenDev = fetch(construirUrl("/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "admin@incatour.com",
                contrasenia: "AdminIncaTour123",
            }),
        })
            .then(async (res) => {
                if (!res.ok) return null;
                const cuerpo = (await res.json()) as { token?: string };
                if (cuerpo.token && typeof window !== "undefined") {
                    localStorage.setItem("token", cuerpo.token);
                }
                return cuerpo.token ?? null;
            })
            .catch(() => null)
            .finally(() => {
                promesaTokenDev = null;
            });
    }
    return promesaTokenDev;
}

export async function cabecerasAuthAsync(forzarRenovacion = false): Promise<HeadersInit> {
    const token = await obtenerTokenAutenticado(forzarRenovacion);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function solicitarApiConAuth<T>(
    ruta: string,
    opciones: RequestInit = {},
): Promise<T> {
    const headers = await cabecerasAuthAsync(false);
    try {
        return await solicitarApi<T>(ruta, {
            ...opciones,
            headers: { ...headers, ...opciones.headers },
        });
    } catch (err) {
        const estado = (err as { estado?: number })?.estado;
        if (estado === 401 || estado === 403) {
            const headersRenovados = await cabecerasAuthAsync(true);
            return solicitarApi<T>(ruta, {
                ...opciones,
                headers: { ...headersRenovados, ...opciones.headers },
            });
        }
        throw err;
    }
}

function respuestaDatos<T>(respuesta: RespuestaDatos<T>): T {
    return respuesta.data;
}

function normalizarPaquete(paquete: PaqueteApi): Paquete {
    return {
        ...paquete,
        id: paquete.idpaquete,
    };
}

export async function listarPaquetes(): Promise<Paquete[]> {
    const headers = await cabecerasAuthAsync();
    return solicitarApi<RespuestaDatos<PaqueteApi[]>>("/paquetes", {
        headers,
    })
        .then(respuestaDatos)
        .then((datos) => datos.map(normalizarPaquete));
}

export async function obtenerPaquetePorId(id: number): Promise<Paquete> {
    const headers = await cabecerasAuthAsync();
    return solicitarApi<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}`, {
        headers,
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function registrarPaquete(
    datos: DatosCrearPaquete,
): Promise<Paquete> {
    const headers = await cabecerasAuthAsync();
    return solicitarApi<RespuestaDatos<PaqueteApi>>("/paquetes", {
        method: "POST",
        headers,
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function modificarPaquete(
    id: number,
    datos: DatosModificarPaquete,
): Promise<Paquete> {
    const headers = await cabecerasAuthAsync();
    return solicitarApi<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function darDeBajaPaquete(id: number): Promise<Paquete> {
    const headers = await cabecerasAuthAsync();
    return solicitarApi<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}/baja`, {
        method: "PATCH",
        headers,
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function listarServiciosDisponiblesCatalogo(): Promise<
    ServicioDisponiblePaquete[]
> {
    try {
        const headers = await cabecerasAuthAsync();
        const resProveedores = await solicitarApi<
            RespuestaDatos<
                {
                    idproveedor: number;
                    razonSocial: string;
                    tipoProveedor: string;
                    estado: string;
                }[]
            >
        >("/proveedores?estado=ACTIVO", { headers });

        const proveedores = resProveedores.data ?? [];
        const listasPorProveedor = await Promise.all(
            proveedores.map((prov) =>
                solicitarApi<RespuestaDatos<ServicioDisponiblePaquete[]>>(
                    `/proveedores/${prov.idproveedor}/servicios?estado=ACTIVO`,
                    { headers },
                )
                    .then((r) => r.data ?? [])
                    .catch(() => [] as ServicioDisponiblePaquete[]),
            ),
        );

        return listasPorProveedor.flat();
    } catch {
        return [];
    }
}

export const clavesPaquetes = {
    todos: ["paquetes"] as const,
    uno: (id: number) => ["paquetes", id] as const,
    serviciosCatalogo: ["servicios-catalogo-paquetes"] as const,
};

export function usePaquetes() {
    return useQuery({
        queryKey: clavesPaquetes.todos,
        queryFn: listarPaquetes,
    });
}

export function usePaqueteDetalle(id: number | null) {
    return useQuery({
        queryKey: clavesPaquetes.uno(id ?? 0),
        queryFn: () => obtenerPaquetePorId(id!),
        enabled: id !== null && Number.isInteger(id) && id > 0,
    });
}

export function useServiciosDisponiblesCatalogo() {
    return useQuery({
        queryKey: clavesPaquetes.serviciosCatalogo,
        queryFn: listarServiciosDisponiblesCatalogo,
    });
}

export function useRegistrarPaquete() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: registrarPaquete,
        onSuccess: () =>
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            }),
    });
}

export function useModificarPaquete() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            datos,
        }: {
            id: number;
            datos: DatosModificarPaquete;
        }) => modificarPaquete(id, datos),
        onSuccess: (_, variables) => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            });
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.uno(variables.id),
            });
        },
    });
}

export function useDarDeBajaPaquete() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: darDeBajaPaquete,
        onSuccess: () =>
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            }),
    });
}
