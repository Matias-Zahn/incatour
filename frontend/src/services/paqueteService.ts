import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { solicitarApi } from "./clienteApi";
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

const URL_API_CONFIG: string = import.meta.env.VITE_API_URL ?? "/api";
const ORIGEN_BACKEND: string = URL_API_CONFIG.startsWith("http")
    ? URL_API_CONFIG.replace(/\/api\/?$/, "")
    : "http://localhost:3000";

export function resolverUrlImagenPaquete(url?: string | null): string {
    if (!url) {
        return `${ORIGEN_BACKEND}/imagenes/catalogo/camino_inca_tradicional.jpg`;
    }
    if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("blob:") ||
        url.startsWith("data:")
    ) {
        return url;
    }
    return `${ORIGEN_BACKEND}${url.startsWith("/") ? "" : "/"}${url}`;
}

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
    imagenPrincipal?: string;
    imagenes?: string[];
    tieneImagenesPropias?: boolean;
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
    idcircuito?: number;
    nombrePaquete?: string;
    condiciones?: string;
    tipoGarantia?: TipoGarantiaPaquete;
    idservicioGarantizado?: number;
    localidadGarantizada?: string;
    categoriaGarantizada?: string;
    tipoHabitacionGarantizada?: string;
    nochesPrevias?: number;
    nochesPosteriores?: number;
    diasDisponibles?: string;
    matrizPrecios?: PrecioTemporadaInput[];
    serviciosIncluidos?: number[];
};

type PaqueteApi = Omit<Paquete, "id">;

type RespuestaDatos<T> = {
    mensaje?: string;
    data: T;
};

function respuestaDatos<T>(respuesta: RespuestaDatos<T>): T {
    return respuesta.data;
}

function normalizarPaquete(paquete: PaqueteApi): Paquete {
    return {
        ...paquete,
        id: paquete.idpaquete,
    };
}

export type RespuestaSubirImagenPaquete = {
    idpaquete: number;
    archivo: string;
    url: string;
    archivos?: string[];
    urls?: string[];
};

export type FiltrosPaquete = {
    estado?: "ACTIVO" | "INACTIVO" | "TODOS";
    idcircuito?: number;
    nombrePaquete?: string;
};

export async function listarPaquetes(
    filtros?: FiltrosPaquete | Record<string, unknown>,
): Promise<Paquete[]> {
    const params = new URLSearchParams();
    if (typeof filtros?.estado === "string" && filtros.estado) {
        params.set("estado", filtros.estado);
    }
    if (typeof filtros?.idcircuito === "number" && filtros.idcircuito > 0) {
        params.set("idcircuito", String(filtros.idcircuito));
    }
    if (
        typeof filtros?.nombrePaquete === "string" &&
        filtros.nombrePaquete.trim()
    ) {
        params.set("nombrePaquete", filtros.nombrePaquete.trim());
    }
    const query = params.toString();
    return solicitarApi<RespuestaDatos<PaqueteApi[]>>(
        query ? `/paquetes?${query}` : "/paquetes",
    )
        .then(respuestaDatos)
        .then((datos) => datos.map(normalizarPaquete));
}

export async function obtenerPaquetePorId(id: number): Promise<Paquete> {
    return solicitarApi<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}`)
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function registrarPaquete(
    datos: DatosCrearPaquete,
): Promise<Paquete> {
    return solicitarApi<RespuestaDatos<PaqueteApi>>("/paquetes", {
        method: "POST",
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function modificarPaquete(
    id: number,
    datos: DatosModificarPaquete,
): Promise<Paquete> {
    return solicitarApi<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function darDeBajaPaquete(id: number): Promise<Paquete> {
    return solicitarApi<RespuestaDatos<PaqueteApi>>(
        `/paquetes/${id}/baja`,
        {
            method: "PATCH",
        },
    )
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export function extraerNombreFotoCarrusel(
    urlImagen: string,
    indiceFallback = 0,
): string {
    const sinQuery = urlImagen.split("?")[0] ?? "";
    const segmentoFinal = sinQuery.split("/").pop() ?? "";
    const base = segmentoFinal.replace(/\.(jpe?g|png|webp)$/i, "").toLowerCase();
    if (
        ["principal", "foto_1", "foto_2", "foto_3", "foto_4", "foto_5"].includes(
            base,
        )
    ) {
        return base === "foto_1" ? "principal" : base;
    }
    return indiceFallback === 0 ? "principal" : `foto_${indiceFallback + 1}`;
}

export async function subirImagenPaquete(
    idPaquete: number,
    archivos: File | File[],
    metodo: "POST" | "PUT" = "POST",
): Promise<RespuestaSubirImagenPaquete> {
    const lista = Array.isArray(archivos) ? archivos : [archivos];
    const formData = new FormData();
    for (const archivo of lista) {
        formData.append("imagenes", archivo);
    }

    return solicitarApi<
        RespuestaDatos<{
            idpaquete: number;
            totalImagenes?: number;
            principal?: string;
            carrusel?: string[];
            archivo?: string;
            url?: string;
            archivos?: string[];
            urls?: string[];
        }>
    >(`/paquetes/${idPaquete}/carrusel`, {
        method: metodo,
        body: formData,
    }).then((res) => {
        const d = respuestaDatos(res);
        const urls = d.carrusel ?? d.urls ?? (d.principal ? [d.principal] : []);
        return {
            idpaquete: d.idpaquete,
            archivo: d.archivo ?? "principal",
            url: d.principal ?? d.url ?? urls[0] ?? "",
            archivos: d.archivos ?? urls,
            urls,
        };
    });
}

export async function modificarFotoIndividualPaquete(
    idPaquete: number,
    nombreFoto: string,
    archivo: File,
): Promise<{ idpaquete: number; fotoModificada: string; url: string }> {
    const formData = new FormData();
    formData.append("imagen", archivo);

    return solicitarApi<
        RespuestaDatos<{ idpaquete: number; fotoModificada: string; url: string }>
    >(`/paquetes/${idPaquete}/carrusel/${nombreFoto}`, {
        method: "PUT",
        body: formData,
    }).then(respuestaDatos);
}

export async function eliminarFotoIndividualPaquete(
    idPaquete: number,
    nombreFoto: string,
): Promise<{ idpaquete: number; fotoEliminada: string }> {
    return solicitarApi<
        RespuestaDatos<{ idpaquete: number; fotoEliminada: string }>
    >(`/paquetes/${idPaquete}/carrusel/${nombreFoto}`, {
        method: "DELETE",
    }).then(respuestaDatos);
}

export async function listarServiciosDisponiblesCatalogo(): Promise<
    ServicioDisponiblePaquete[]
> {
    try {
        const resProveedores = await solicitarApi<
            RespuestaDatos<
                {
                    idproveedor: number;
                    razonSocial: string;
                    tipoProveedor: string;
                    estado: string;
                }[]
            >
        >("/proveedores?estado=ACTIVO");

        const proveedores = resProveedores.data ?? [];
        const listasPorProveedor = await Promise.all(
            proveedores.map((prov) =>
                solicitarApi<RespuestaDatos<ServicioDisponiblePaquete[]>>(
                    `/proveedores/${prov.idproveedor}/servicios?estado=ACTIVO`,
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
    lista: (filtros?: FiltrosPaquete) =>
        filtros
            ? (["paquetes", filtros] as const)
            : (["paquetes"] as const),
    uno: (id: number) => ["paquetes", id] as const,
    serviciosCatalogo: ["servicios-catalogo-paquetes"] as const,
};

export function usePaquetes(filtros?: FiltrosPaquete) {
    return useQuery({
        queryKey: clavesPaquetes.lista(filtros),
        queryFn: () => listarPaquetes(filtros),
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

export function useSubirImagenPaquete() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            archivos,
            metodo = "POST",
        }: {
            id: number;
            archivos: File | File[];
            metodo?: "POST" | "PUT";
        }) => subirImagenPaquete(id, archivos, metodo),
        onSuccess: (_, variables) => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            });
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.uno(variables.id),
            });
            clienteConsultas.invalidateQueries({
                queryKey: ["catalogo-publico"],
            });
        },
    });
}

export function useModificarFotoIndividualPaquete() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            nombreFoto,
            archivo,
        }: {
            id: number;
            nombreFoto: string;
            archivo: File;
        }) => modificarFotoIndividualPaquete(id, nombreFoto, archivo),
        onSuccess: (_, variables) => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            });
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.uno(variables.id),
            });
            clienteConsultas.invalidateQueries({
                queryKey: ["catalogo-publico"],
            });
        },
    });
}

export function useEliminarFotoIndividualPaquete() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            nombreFoto,
        }: {
            id: number;
            nombreFoto: string;
        }) => eliminarFotoIndividualPaquete(id, nombreFoto),
        onSuccess: (_, variables) => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.todos,
            });
            clienteConsultas.invalidateQueries({
                queryKey: clavesPaquetes.uno(variables.id),
            });
            clienteConsultas.invalidateQueries({
                queryKey: ["catalogo-publico"],
            });
        },
    });
}
