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
    if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS !== "false") {
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
                const cuerpo = (await res.json()) as { data?: { token?: string } };
                const token = cuerpo.data?.token;
                if (token && typeof window !== "undefined") {
                    localStorage.setItem("token", token);
                }
                return token ?? null;
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

export type RespuestaSubirImagenPaquete = {
    idpaquete: number;
    archivo: string;
    url: string;
    archivos?: string[];
    urls?: string[];
};

export async function listarPaquetes(): Promise<Paquete[]> {
    return solicitarApiConAuth<RespuestaDatos<PaqueteApi[]>>("/paquetes")
        .then(respuestaDatos)
        .then((datos) => datos.map(normalizarPaquete));
}

export async function obtenerPaquetePorId(id: number): Promise<Paquete> {
    return solicitarApiConAuth<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}`)
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function registrarPaquete(
    datos: DatosCrearPaquete,
): Promise<Paquete> {
    return solicitarApiConAuth<RespuestaDatos<PaqueteApi>>("/paquetes", {
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
    return solicitarApiConAuth<RespuestaDatos<PaqueteApi>>(`/paquetes/${id}`, {
        method: "PUT",
        body: JSON.stringify(datos),
    })
        .then(respuestaDatos)
        .then(normalizarPaquete);
}

export async function darDeBajaPaquete(id: number): Promise<Paquete> {
    return solicitarApiConAuth<RespuestaDatos<PaqueteApi>>(
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

    return solicitarApiConAuth<
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

    return solicitarApiConAuth<
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
    return solicitarApiConAuth<
        RespuestaDatos<{ idpaquete: number; fotoEliminada: string }>
    >(`/paquetes/${idPaquete}/carrusel/${nombreFoto}`, {
        method: "DELETE",
    }).then(respuestaDatos);
}

export async function listarServiciosDisponiblesCatalogo(): Promise<
    ServicioDisponiblePaquete[]
> {
    try {
        const resProveedores = await solicitarApiConAuth<
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
                solicitarApiConAuth<RespuestaDatos<ServicioDisponiblePaquete[]>>(
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
