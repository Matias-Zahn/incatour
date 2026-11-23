import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import DialogoConfirmacion from "./DialogoConfirmacion";
import { IconoSalir } from "../pages/guia/IconosGuia";
import { cerrarSesion } from "../services/autenticacionService";
import logoIncaTour from "../assets/logo-incatour.png";
import { criticosEnCurso, useIncidentes } from "../services/guiaService";
import { useSalidas } from "../services/salidaService";
import { obtenerUsuario } from "../services/sesionService";
import { listarSolicitudesPendientes } from "../services/solicitudService";

type IconoProps = {
    className?: string;
};

function IconoMenu({ className }: IconoProps) {
    return (
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <line x1="4" x2="20" y1="7" y2="7" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="17" y2="17" />
        </svg>
    );
}

function IconoCerrar({ className }: IconoProps) {
    return (
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );
}

function IconoChevron({ className }: IconoProps) {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

function IconoFlechaExterna({ className }: IconoProps) {
    return (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
        </svg>
    );
}

function IconoInicio() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    );
}

function IconoCircuitos() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
    );
}

function IconoPaquetes() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16.5 9.4 7.55 4.24" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.29 7 12 12 20.71 7" />
            <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
    );
}

function IconoProveedores() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M8 10h.01" />
            <path d="M16 10h.01" />
            <path d="M12 10h.01" />
            <path d="M8 14h.01" />
            <path d="M16 14h.01" />
            <path d="M12 14h.01" />
        </svg>
    );
}

function IconoSalidas() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 14h.01" />
            <path d="M12 14h.01" />
            <path d="M16 14h.01" />
            <path d="M8 18h.01" />
            <path d="M12 18h.01" />
            <path d="M16 18h.01" />
        </svg>
    );
}

function IconoReservas() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
            <path d="m9 16 2 2 4-4" />
        </svg>
    );
}

function IconoPersonal() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function IconoResenias() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function IconoReportes() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3v18h18" />
            <path d="M8 17v-6" />
            <path d="M13 17V7" />
            <path d="M18 17v-3" />
        </svg>
    );
}

function IconoOjo() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function PillAviso({ cantidad }: { cantidad: number }) {
    if (cantidad <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-rose-700 ring-1 ring-inset ring-rose-500/20">
            <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
            {cantidad}
        </span>
    );
}

type ElementoMenu = {
    etiqueta: string;
    descripcion: string;
    ruta: string;
    icono: ReactNode;
};

type GrupoNavegacion = {
    id: string;
    etiqueta: string;
    encabezado: string;
    elementos: ElementoMenu[];
};

const gruposNavegacion: GrupoNavegacion[] = [
    {
        id: "operacion",
        etiqueta: "Operación",
        encabezado: "Operación diaria",
        elementos: [
            {
                etiqueta: "Salidas",
                descripcion: "Programación, cupos y confirmaciones",
                ruta: "/gestion/salidas",
                icono: <IconoSalidas />,
            },
            {
                etiqueta: "Reservas y pagos",
                descripcion: "Ventas, pasajeros y reintegros",
                ruta: "/gestion/reservas",
                icono: <IconoReservas />,
            },
            {
                etiqueta: "Solicitudes de alojamiento",
                descripcion: "Respuestas de hoteles a solicitud",
                ruta: "/gestion/solicitudes",
                icono: <IconoProveedores />,
            },
        ],
    },
    {
        id: "catalogo",
        etiqueta: "Catálogo",
        encabezado: "Oferta comercial",
        elementos: [
            {
                etiqueta: "Paquetes turísticos",
                descripcion: "Tarifas, servicios y garantías",
                ruta: "/gestion/paquetes",
                icono: <IconoPaquetes />,
            },
            {
                etiqueta: "Circuitos",
                descripcion: "Rutas, etapas y dificultades",
                ruta: "/gestion/circuitos",
                icono: <IconoCircuitos />,
            },
        ],
    },
    {
        id: "recursos",
        etiqueta: "Recursos",
        encabezado: "Proveedores y equipo",
        elementos: [
            {
                etiqueta: "Proveedores",
                descripcion: "Hoteles, transporte, tren y equipo",
                ruta: "/gestion/proveedores",
                icono: <IconoProveedores />,
            },
            {
                etiqueta: "Personal",
                descripcion: "Guías y porteadores habilitados",
                ruta: "/gestion/personal",
                icono: <IconoPersonal />,
            },
        ],
    },
    {
        id: "analisis",
        etiqueta: "Análisis",
        encabezado: "Seguimiento y calidad",
        elementos: [
            {
                etiqueta: "Reportes",
                descripcion: "Ocupación, ventas e ingresos",
                ruta: "/gestion/reportes",
                icono: <IconoReportes />,
            },
            {
                etiqueta: "Reseñas y evaluaciones",
                descripcion: "Calificaciones y desempeño",
                ruta: "/gestion/evaluaciones",
                icono: <IconoResenias />,
            },
        ],
    },
];

// Lo que pide atención, con las mismas consultas del Inicio: react-query las comparte y no se piden dos veces
function useAvisosGestion(): Record<string, number> {
    const salidas = useSalidas().data ?? [];
    const solicitudes =
        useQuery({
            queryKey: ["solicitudes"],
            queryFn: listarSolicitudesPendientes,
            refetchInterval: 30_000,
            refetchOnWindowFocus: true,
        }).data ?? [];
    const incidentes = useIncidentes().data ?? [];
    return {
        "/": criticosEnCurso(incidentes, salidas).length,
        "/gestion/salidas": salidas.filter((s) => s.alertas?.length > 0).length,
        "/gestion/solicitudes": solicitudes.length,
    };
}

type BarraSuperiorProps = {
    seccion: string;
};

function BarraSuperior({ seccion }: BarraSuperiorProps) {
    const usuario = obtenerUsuario();
    const avisos = useAvisosGestion();
    const navegar = useNavigate();
    const ubicacion = useLocation();

    const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
    const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
    const [modalSalirAbierto, setModalSalirAbierto] = useState(false);

    const contenedorNavRef = useRef<HTMLDivElement>(null);

    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "AD";
    const nombreCompleto = usuario
        ? `${usuario.nombre} ${usuario.apellido}`
        : "Administrador/a";

    const totalAvisos = Object.values(avisos).reduce((acc, n) => acc + n, 0);

    useEffect(() => {
        setMenuAbierto(null);
        setMenuMovilAbierto(false);
    }, [ubicacion.pathname]);

    useEffect(() => {
        function manejarClickAfuera(evento: MouseEvent) {
            if (
                contenedorNavRef.current &&
                !contenedorNavRef.current.contains(evento.target as Node)
            ) {
                setMenuAbierto(null);
            }
        }
        function manejarTecla(evento: KeyboardEvent) {
            if (evento.key === "Escape") {
                setMenuAbierto(null);
                setMenuMovilAbierto(false);
            }
        }
        document.addEventListener("mousedown", manejarClickAfuera);
        document.addEventListener("keydown", manejarTecla);
        return () => {
            document.removeEventListener("mousedown", manejarClickAfuera);
            document.removeEventListener("keydown", manejarTecla);
        };
    }, []);

    function elementoEstaActivo(elemento: ElementoMenu) {
        return (
            ubicacion.pathname === elemento.ruta ||
            ubicacion.pathname.startsWith(`${elemento.ruta}/`) ||
            elemento.etiqueta === seccion
        );
    }

    function grupoEstaActivo(grupo: GrupoNavegacion) {
        return grupo.elementos.some(elementoEstaActivo);
    }

    function avisosDeGrupo(grupo: GrupoNavegacion) {
        return grupo.elementos.reduce((acc, el) => acc + (avisos[el.ruta] ?? 0), 0);
    }

    const inicioActivo = ubicacion.pathname === "/" || seccion === "Inicio";
    const avisosInicio = avisos["/"] ?? 0;
    const hayGrupoDesplegado =
        menuAbierto !== null && menuAbierto !== "cuenta";

    return (
        <header
            ref={contenedorNavRef}
            className="sticky top-0 z-40 border-b border-borde/80 bg-white/80 shadow-[0_1px_2px_rgba(18,61,112,0.04)] backdrop-blur-xl"
        >
            {/* Acento sutil de marca superior */}
            <div
                aria-hidden="true"
                className="h-[2px] w-full bg-gradient-to-r from-navegacion via-marca to-[#16d6dc]"
            />

            <div className="mx-auto flex h-15 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                {/* IZQUIERDA: MARCA */}
                <Link
                    to="/"
                    className="group flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-2 transition"
                    title="IncaTour · Inicio de gestión"
                >
                    <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-navegacion/10 transition group-hover:scale-[1.03] group-hover:ring-marca/40">
                        <img
                            src={logoIncaTour}
                            alt="Logo IncaTour"
                            className="size-full object-contain"
                        />
                    </div>
                    <span className="text-[15px] font-bold tracking-[-0.02em] text-navegacion">
                        IncaTour
                    </span>
                    <span className="hidden rounded-full bg-navegacion/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-tight text-navegacion/75 sm:inline-flex">
                        Gestión
                    </span>
                </Link>

                {/* CENTRO: PÍLDORA SEGMENTADA ESTILO MODERN SAAS */}
                <nav
                    aria-label="Navegación administrativa"
                    className="hidden items-center gap-0.5 rounded-full bg-fondo/95 p-1 ring-1 ring-borde/80 lg:flex"
                >
                    <NavLink
                        to="/"
                        end
                        onMouseEnter={() => {
                            if (hayGrupoDesplegado) setMenuAbierto(null);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] tracking-[-0.01em] transition-all ${
                            inicioActivo
                                ? "bg-white font-semibold text-navegacion shadow-[0_1px_3px_rgba(18,61,112,0.10)] ring-1 ring-navegacion/[0.06]"
                                : "font-medium text-texto-suave hover:bg-white/60 hover:text-navegacion"
                        }`}
                    >
                        <span>Inicio</span>
                        <PillAviso cantidad={avisosInicio} />
                    </NavLink>

                    {gruposNavegacion.map((grupo) => {
                        const abierto = menuAbierto === grupo.id;
                        const activo = grupoEstaActivo(grupo);
                        const avisosGrupo = avisosDeGrupo(grupo);

                        return (
                            <div
                                key={grupo.id}
                                className="relative"
                                onMouseEnter={() => {
                                    // Si ya había un menú abierto, pasar el cursor cambia suavemente de grupo
                                    if (hayGrupoDesplegado && menuAbierto !== grupo.id) {
                                        setMenuAbierto(grupo.id);
                                    }
                                }}
                            >
                                <button
                                    type="button"
                                    aria-expanded={abierto}
                                    aria-haspopup="menu"
                                    onClick={() =>
                                        setMenuAbierto((prev) =>
                                            prev === grupo.id ? null : grupo.id,
                                        )
                                    }
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] tracking-[-0.01em] transition-all ${
                                        activo || abierto
                                            ? "bg-white font-semibold text-navegacion shadow-[0_1px_3px_rgba(18,61,112,0.10)] ring-1 ring-navegacion/[0.06]"
                                            : "font-medium text-texto-suave hover:bg-white/60 hover:text-navegacion"
                                    }`}
                                >
                                    <span>{grupo.etiqueta}</span>
                                    <PillAviso cantidad={avisosGrupo} />
                                    <IconoChevron
                                        className={`opacity-65 transition-transform duration-150 ${
                                            abierto ? "rotate-180 opacity-100" : ""
                                        }`}
                                    />
                                </button>

                                {abierto ? (
                                    <div
                                        role="menu"
                                        className="animar-menu absolute left-1/2 top-full mt-3 w-80 -translate-x-1/2 rounded-2xl border border-borde/80 bg-white/98 p-2 shadow-[0_20px_44px_-12px_rgba(18,61,112,0.18),0_4px_12px_-2px_rgba(18,61,112,0.06)] backdrop-blur-xl"
                                    >
                                        <p className="px-3 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-texto-suave/80">
                                            {grupo.encabezado}
                                        </p>
                                        <div className="space-y-0.5">
                                            {grupo.elementos.map((el) => {
                                                const esActivo = elementoEstaActivo(el);
                                                const avisoEl = avisos[el.ruta] ?? 0;
                                                return (
                                                    <NavLink
                                                        key={el.ruta}
                                                        to={el.ruta}
                                                        role="menuitem"
                                                        className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                                                            esActivo
                                                                ? "bg-marca-suave/75 text-navegacion"
                                                                : "text-texto hover:bg-fondo/90"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg transition ${
                                                                esActivo
                                                                    ? "bg-white text-marca-oscura shadow-2xs ring-1 ring-marca/20"
                                                                    : "bg-fondo text-texto-suave ring-1 ring-borde/60 group-hover:bg-white group-hover:text-marca-oscura group-hover:ring-marca/25"
                                                            }`}
                                                        >
                                                            {el.icono}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="flex items-center justify-between gap-2">
                                                                <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold tracking-[-0.01em] text-navegacion">
                                                                    {el.etiqueta}
                                                                    {esActivo ? (
                                                                        <span
                                                                            aria-hidden="true"
                                                                            className="size-1.5 shrink-0 rounded-full bg-marca"
                                                                        />
                                                                    ) : null}
                                                                </span>
                                                                <PillAviso cantidad={avisoEl} />
                                                            </span>
                                                            <span className="mt-0.5 block text-xs leading-snug text-texto-suave">
                                                                {el.descripcion}
                                                            </span>
                                                        </span>
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </nav>

                {/* DERECHA: VISTA CLIENTE + CUENTA + MÓVIL */}
                <div className="flex shrink-0 items-center gap-2">
                    <Link
                        to="/catalogo?vista=admin"
                        className="group hidden items-center gap-1.5 rounded-full border border-borde/90 bg-white px-3 py-1.5 text-xs font-semibold text-texto transition hover:border-marca/45 hover:bg-marca-suave/50 hover:text-navegacion sm:inline-flex"
                        title="Ver tienda como cliente (Vista previa)"
                    >
                        <IconoOjo />
                        <span>Vista cliente</span>
                        <IconoFlechaExterna className="text-texto-suave transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-marca-oscura" />
                    </Link>

                    {/* MENÚ DE CUENTA */}
                    <div className="relative">
                        <button
                            type="button"
                            aria-expanded={menuAbierto === "cuenta"}
                            aria-haspopup="menu"
                            aria-label="Menú de cuenta"
                            onClick={() =>
                                setMenuAbierto((prev) =>
                                    prev === "cuenta" ? null : "cuenta",
                                )
                            }
                            className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-sm transition ${
                                menuAbierto === "cuenta"
                                    ? "border-marca/50 bg-marca-suave/60 shadow-2xs"
                                    : "border-borde/90 bg-white hover:border-navegacion/25 hover:bg-fondo/60"
                            }`}
                        >
                            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-navegacion to-marca-oscura text-[11px] font-bold text-white shadow-2xs">
                                {iniciales}
                            </span>
                            <span className="hidden max-w-28 truncate text-xs font-semibold text-navegacion xl:inline">
                                {usuario?.nombre ?? "Admin"}
                            </span>
                            <IconoChevron
                                className={`text-texto-suave transition-transform duration-150 ${
                                    menuAbierto === "cuenta" ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {menuAbierto === "cuenta" ? (
                            <div
                                role="menu"
                                className="animar-menu absolute right-0 top-full mt-3 w-64 rounded-2xl border border-borde/80 bg-white/98 p-2 shadow-[0_20px_44px_-12px_rgba(18,61,112,0.18),0_4px_12px_-2px_rgba(18,61,112,0.06)] backdrop-blur-xl"
                            >
                                <div className="flex items-center gap-3 rounded-xl bg-fondo/70 p-2.5">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navegacion to-marca-oscura text-xs font-bold text-white">
                                        {iniciales}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-navegacion">
                                            {nombreCompleto}
                                        </p>
                                        <p className="truncate text-xs text-texto-suave">
                                            {usuario?.email ?? "Perfil Administrador"}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-2 space-y-0.5">
                                    <Link
                                        to="/catalogo?vista=admin"
                                        role="menuitem"
                                        className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-texto transition hover:bg-fondo sm:hidden"
                                    >
                                        <span className="flex items-center gap-2">
                                            <IconoOjo />
                                            Ver tienda como cliente
                                        </span>
                                        <IconoFlechaExterna className="text-texto-suave" />
                                    </Link>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setMenuAbierto(null);
                                            setModalSalirAbierto(true);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-peligro transition hover:bg-rose-50"
                                    >
                                        <IconoSalir tamano={15} />
                                        <span>Cerrar sesión</span>
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* BOTÓN MENÚ MÓVIL / TABLET */}
                    <button
                        type="button"
                        aria-expanded={menuMovilAbierto}
                        aria-label={menuMovilAbierto ? "Cerrar menú" : "Abrir menú"}
                        onClick={() => setMenuMovilAbierto((prev) => !prev)}
                        className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-borde/90 bg-white text-navegacion transition hover:bg-fondo lg:hidden"
                    >
                        {menuMovilAbierto ? <IconoCerrar /> : <IconoMenu />}
                        {!menuMovilAbierto && totalAvisos > 0 ? (
                            <span
                                aria-hidden="true"
                                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white"
                            />
                        ) : null}
                    </button>
                </div>
            </div>

            {/* PANEL DESPLEGABLE MÓVIL / TABLET */}
            {menuMovilAbierto ? (
                <div className="animar-menu max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-borde/80 bg-white/98 px-4 py-4 shadow-xl backdrop-blur-xl lg:hidden">
                    <nav aria-label="Navegación administrativa móvil" className="space-y-4">
                        <NavLink
                            to="/"
                            end
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${
                                inicioActivo
                                    ? "bg-marca-suave/80 text-navegacion"
                                    : "text-texto hover:bg-fondo"
                            }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <IconoInicio />
                                Inicio
                            </span>
                            <PillAviso cantidad={avisosInicio} />
                        </NavLink>

                        {gruposNavegacion.map((grupo) => (
                            <div key={grupo.id}>
                                <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-wider text-texto-suave/80">
                                    {grupo.encabezado}
                                </p>
                                <div className="space-y-0.5">
                                    {grupo.elementos.map((el) => {
                                        const esActivo = elementoEstaActivo(el);
                                        const avisoEl = avisos[el.ruta] ?? 0;
                                        return (
                                            <NavLink
                                                key={el.ruta}
                                                to={el.ruta}
                                                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium ${
                                                    esActivo
                                                        ? "bg-marca-suave/80 font-semibold text-navegacion"
                                                        : "text-texto hover:bg-fondo"
                                                }`}
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <span className="text-texto-suave">
                                                        {el.icono}
                                                    </span>
                                                    {el.etiqueta}
                                                </span>
                                                <PillAviso cantidad={avisoEl} />
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="border-t border-borde/80 pt-3 sm:hidden">
                            <Link
                                to="/catalogo?vista=admin"
                                className="flex items-center justify-between rounded-xl bg-fondo px-3 py-2.5 text-sm font-semibold text-navegacion"
                            >
                                <span className="flex items-center gap-2">
                                    <IconoOjo />
                                    Ver tienda como cliente
                                </span>
                                <IconoFlechaExterna className="text-texto-suave" />
                            </Link>
                        </div>
                    </nav>
                </div>
            ) : null}

            <DialogoConfirmacion
                abierto={modalSalirAbierto}
                titulo="¿Deseás cerrar tu sesión?"
                descripcion="Al confirmar, cerrarás tu sesión en el panel de gestión de IncaTour."
                textoConfirmar="Sí, salir"
                textoCancelar="Cancelar"
                onConfirmar={() => {
                    cerrarSesion();
                    navegar("/login", { replace: true });
                }}
                onCancelar={() => setModalSalirAbierto(false)}
            />
        </header>
    );
}

export default BarraSuperior;
