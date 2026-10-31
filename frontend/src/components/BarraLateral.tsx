import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import logoIncaTour from "../assets/logo-incatour.png";
import { obtenerUsuario } from "../services/sesionService";

function IconoMenu() {
    return (
        <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    );
}

function IconoInicio() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    );
}

function IconoCircuitos() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
    );
}

function IconoPaquetes() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M16.5 9.4 7.55 4.24" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.29 7 12 12 20.71 7" />
            <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
    );
}

function IconoProveedores() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
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
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
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
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
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
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function IconoResenias() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function IconoOjo() {
    return (
        <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function IconoReportes() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M3 3v18h18" />
            <path d="M8 17v-6" />
            <path d="M13 17V7" />
            <path d="M18 17v-3" />
        </svg>
    );
}

type ElementoNavegacion = {
    etiqueta: string;
    icono: ReactNode;
    ruta: string;
};

const elementosNavegacion: ElementoNavegacion[] = [
    { etiqueta: "Inicio", icono: <IconoInicio />, ruta: "/" },
    { etiqueta: "Circuitos", icono: <IconoCircuitos />, ruta: "/gestion/circuitos" },
    { etiqueta: "Paquetes turísticos", icono: <IconoPaquetes />, ruta: "/gestion/paquetes" },
    { etiqueta: "Proveedores", icono: <IconoProveedores />, ruta: "/gestion/proveedores" },
    { etiqueta: "Salidas", icono: <IconoSalidas />, ruta: "/gestion/salidas" },
    { etiqueta: "Reservas y pagos", icono: <IconoReservas />, ruta: "/gestion/solicitudes" },
    { etiqueta: "Reportes", icono: <IconoReportes />, ruta: "/gestion/reportes" },
    { etiqueta: "Personal", icono: <IconoPersonal />, ruta: "/gestion/personal" },
    { etiqueta: "Reseñas y evaluaciones", icono: <IconoResenias />, ruta: "/gestion/evaluaciones" },
];

type BarraLateralProps = {
    seccionActiva: string;
};

function BarraLateral({ seccionActiva }: BarraLateralProps) {
    const [colapsada, setColapsada] = useState<boolean>(() => {
        try {
            const guardado = localStorage.getItem("incatour_admin_sidebar_colapsada");
            return guardado !== null ? JSON.parse(guardado) : false;
        } catch {
            return false;
        }
    });

    const usuario = obtenerUsuario();
    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "AD";

    function toggleColapsada() {
        setColapsada((prev) => {
            const nuevo = !prev;
            try {
                localStorage.setItem(
                    "incatour_admin_sidebar_colapsada",
                    JSON.stringify(nuevo),
                );
            } catch {
                // Ignore storage error
            }
            return nuevo;
        });
    }

    const claseElemento = (estaActivo: boolean) =>
        `flex w-full items-center ${
            colapsada ? "justify-center px-2 py-3" : "gap-3 px-3.5 py-2.5"
        } rounded-xl text-sm font-semibold transition-all max-md:px-2.5 max-md:py-2 ${
            estaActivo
                ? "bg-[#16d6dc] text-[#075274] shadow-sm"
                : "text-white/90 hover:bg-white/15 hover:text-white"
        }`;

    return (
        <aside
            aria-label="Navegación administrativa"
            className={`flex shrink-0 flex-col bg-[#1b9fc7] text-white shadow-md transition-all duration-300 md:sticky md:top-0 md:h-screen max-md:w-full max-md:flex-row max-md:items-center max-md:justify-between max-md:p-3 ${
                colapsada ? "md:w-20 md:p-3.5" : "md:w-64 md:p-5"
            }`}
        >
            {/* CABECERA CON LOGO Y TOGGLE COLAPSAR ESTILO GMAIL */}
            <div
                className={`flex items-center border-b border-white/30 pb-4 max-md:border-none max-md:pb-0 ${
                    colapsada ? "flex-col justify-center gap-2" : "justify-between"
                }`}
            >
                <Link
                    to="/"
                    className="flex items-center gap-3"
                    title="IncaTour - Inicio de gestión"
                >
                    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm transition hover:scale-105">
                        <img
                            src={logoIncaTour}
                            alt="Logo IncaTour"
                            className="size-full object-contain"
                        />
                    </div>
                    {!colapsada && (
                        <div className="max-md:hidden">
                            <h2 className="text-xl font-bold leading-none text-white">
                                IncaTour
                            </h2>
                            <p className="mt-1 text-xs text-cyan-100 max-sm:hidden">
                                Panel de Gestión
                            </p>
                        </div>
                    )}
                </Link>

                <button
                    type="button"
                    onClick={toggleColapsada}
                    className="hidden rounded-lg p-2 text-white/90 transition hover:bg-white/20 hover:text-white md:inline-flex cursor-pointer"
                    title={colapsada ? "Expandir menú lateral" : "Colapsar menú lateral"}
                    aria-label={colapsada ? "Expandir menú lateral" : "Colapsar menú lateral"}
                >
                    <IconoMenu />
                </button>
            </div>

            {/* LISTA DE NAVEGACIÓN */}
            <nav
                aria-label="Navegación administrativa"
                className="mt-6 flex-1 max-md:mt-0 max-md:ml-3 max-md:flex max-md:min-w-0 max-md:overflow-x-auto"
            >
                <ul className="flex flex-col gap-1.5 max-md:flex-row max-md:gap-1">
                    {elementosNavegacion.map((elemento) => (
                        <li key={elemento.etiqueta}>
                            <NavLink
                                to={elemento.ruta}
                                end={elemento.ruta === "/"}
                                title={elemento.etiqueta}
                                aria-label={elemento.etiqueta}
                                className={({ isActive }) => {
                                    const estaActivo =
                                        isActive || elemento.etiqueta === seccionActiva;
                                    return claseElemento(estaActivo);
                                }}
                            >
                                <span className="shrink-0">{elemento.icono}</span>
                                {!colapsada && (
                                    <span className="max-md:hidden whitespace-nowrap">
                                        {elemento.etiqueta}
                                    </span>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* ACCESO A TIENDA COMO CLIENTE */}
            <div className="mt-auto border-t border-white/30 pt-3 max-md:hidden">
                <NavLink
                    to="/catalogo?vista=admin"
                    className={`flex items-center ${
                        colapsada ? "justify-center p-2.5" : "justify-between px-3 py-2"
                    } rounded-xl bg-white/15 text-xs font-semibold text-white transition hover:bg-white/25`}
                    title="Ver tienda como cliente (Vista previa)"
                >
                    <span className="flex items-center gap-2">
                        <IconoOjo />
                        {!colapsada && <span>Ver como cliente</span>}
                    </span>
                    {!colapsada && <span aria-hidden="true">↗</span>}
                </NavLink>
            </div>

            {/* USUARIO LOGUEADO */}
            <div className="mt-3 border-t border-white/30 pt-3 text-xs max-md:border-none max-md:pt-0">
                {!colapsada ? (
                    <div className="max-md:hidden">
                        <p className="text-cyan-100 text-[11px]">Usuario de gestión</p>
                        <p className="font-bold text-white truncate">
                            {usuario
                                ? `${usuario.nombre} ${usuario.apellido}`
                                : "Administrador/a"}
                        </p>
                        <p className="text-cyan-100/80 text-[10px] truncate">
                            {usuario?.email ?? "Perfil Administrador"}
                        </p>
                    </div>
                ) : (
                    <div
                        className="flex justify-center"
                        title={`Administrador: ${usuario ? `${usuario.nombre} ${usuario.apellido}` : "Admin"}`}
                    >
                        <div className="grid size-8 place-items-center rounded-lg bg-white/20 text-xs font-bold text-white">
                            {iniciales}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

export default BarraLateral;
