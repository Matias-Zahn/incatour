import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import EstadoListado from "./EstadoListado";
import {
    Link,
    NavLink,
    useLocation,
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import LimiteDeError from "./LimiteDeError";
import DialogoConfirmacion from "./DialogoConfirmacion";
import logoIncaTour from "../assets/logo-incatour.png";
import {
    limpiarSesion,
    obtenerToken,
    obtenerUsuario,
} from "../services/sesionService";

type LayoutClienteProps = {
    children: ReactNode;
};

function IconoMenu() {
    return (
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" x2="20" y1="7" y2="7" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="17" y2="17" />
        </svg>
    );
}

function IconoCerrar() {
    return (
        <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );
}

function IconoChevron({ className }: { className?: string }) {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

function IconoSalir() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    );
}

function IconoCuenta() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
    );
}

function LayoutCliente({ children }: LayoutClienteProps) {
    const navegar = useNavigate();
    const ubicacion = useLocation();
    const [searchParams] = useSearchParams();
    const [modalSalirAbierto, setModalSalirAbierto] = useState(false);
    const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
    const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
    const headerRef = useRef<HTMLElement>(null);

    const esVistaPreviaAdmin = searchParams.get("vista") === "admin";
    const tieneToken = Boolean(obtenerToken());
    const usuario = tieneToken ? obtenerUsuario() : null;
    const esCliente = usuario?.rol === "CLIENTE";

    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "CL";

    const rutaCatalogo = esVistaPreviaAdmin ? "/catalogo?vista=admin" : "/catalogo";

    useEffect(() => {
        setMenuCuentaAbierto(false);
        setMenuMovilAbierto(false);
    }, [ubicacion.pathname]);

    useEffect(() => {
        function manejarClickAfuera(evento: MouseEvent) {
            if (headerRef.current && !headerRef.current.contains(evento.target as Node)) {
                setMenuCuentaAbierto(false);
            }
        }
        function manejarTecla(evento: KeyboardEvent) {
            if (evento.key === "Escape") {
                setMenuCuentaAbierto(false);
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

    function confirmarCerrarSesion() {
        limpiarSesion();
        setModalSalirAbierto(false);
        navegar("/login", { replace: true });
    }

    const claseEnlace = ({ isActive }: { isActive: boolean }) =>
        `rounded-full px-3.5 py-1.5 text-[13.5px] tracking-[-0.01em] transition-all ${
            isActive
                ? "bg-white font-semibold text-navegacion shadow-[0_1px_3px_rgba(18,61,112,0.10)] ring-1 ring-navegacion/[0.06]"
                : "font-medium text-texto-suave hover:bg-white/60 hover:text-navegacion"
        }`;

    const claseEnlaceMovil = ({ isActive }: { isActive: boolean }) =>
        `block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive
                ? "bg-marca-suave/80 font-semibold text-navegacion"
                : "text-texto hover:bg-fondo"
        }`;

    return (
        <div className="flex min-h-screen flex-col bg-fondo">
            {/* BANNER DE VISTA PREVIA CUANDO EL ADMIN ENTRA A VER CÓMO LO VE EL CLIENTE */}
            {esVistaPreviaAdmin || usuario?.rol === "ADMIN" ? (
                <div className="border-b border-marca-oscura bg-navegacion px-4 py-2 text-xs text-white sm:px-6">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-marca px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                                Vista previa de Administrador
                            </span>
                            <span className="text-white/90">
                                Estás visualizando el portal del cliente. Para reservar, cancelar o reseñar, ingresá con una cuenta de perfil CLIENTE.
                            </span>
                        </div>

                        <Link
                            to="/gestion/paquetes"
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-semibold text-white transition hover:bg-white/25"
                        >
                            ← Volver al Panel de Gestión
                        </Link>
                    </div>
                </div>
            ) : null}

            {/* BARRA SUPERIOR MINIMALISTA */}
            <header
                ref={headerRef}
                className="sticky top-0 z-40 border-b border-borde/80 bg-white/80 shadow-[0_1px_2px_rgba(18,61,112,0.04)] backdrop-blur-xl"
            >
                <div
                    aria-hidden="true"
                    className="h-[2px] w-full bg-gradient-to-r from-navegacion via-marca to-[#16d6dc]"
                />

                <div className="mx-auto flex h-15 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    {/* IZQUIERDA: LOGO */}
                    <Link
                        to={rutaCatalogo}
                        className="group flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-2 transition"
                        title="IncaTour · Inicio"
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
                    </Link>

                    {/* CENTRO: PÍLDORA SEGMENTADA */}
                    <nav
                        aria-label="Secciones del portal del cliente"
                        className="hidden items-center gap-0.5 rounded-full bg-fondo/95 p-1 ring-1 ring-borde/80 md:flex"
                    >
                        <NavLink to={rutaCatalogo} className={claseEnlace}>
                            Paquetes turísticos
                        </NavLink>

                        {usuario && esCliente ? (
                            <>
                                <NavLink to="/mis-reservas" className={claseEnlace}>
                                    Mis reservas
                                </NavLink>
                                <NavLink to="/mis-resenias" className={claseEnlace}>
                                    Publicar reseña
                                </NavLink>
                            </>
                        ) : null}
                    </nav>

                    {/* DERECHA: CUENTA / ACCESO + MENÚ MÓVIL */}
                    <div className="flex shrink-0 items-center gap-2">
                        {usuario ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    aria-expanded={menuCuentaAbierto}
                                    aria-haspopup="menu"
                                    aria-label="Menú de cuenta"
                                    onClick={() => setMenuCuentaAbierto((prev) => !prev)}
                                    className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-sm transition ${
                                        menuCuentaAbierto
                                            ? "border-marca/50 bg-marca-suave/60 shadow-2xs"
                                            : "border-borde/90 bg-white hover:border-navegacion/25 hover:bg-fondo/60"
                                    }`}
                                >
                                    <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-marca to-navegacion text-[11px] font-bold text-white shadow-2xs">
                                        {iniciales}
                                    </span>
                                    <span className="hidden max-w-32 truncate text-xs font-semibold text-navegacion sm:inline">
                                        {usuario.nombre}
                                    </span>
                                    <IconoChevron
                                        className={`text-texto-suave transition-transform duration-150 ${
                                            menuCuentaAbierto ? "rotate-180" : ""
                                        }`}
                                    />
                                </button>

                                {menuCuentaAbierto ? (
                                    <div
                                        role="menu"
                                        className="animar-menu absolute right-0 top-full mt-3 w-64 rounded-2xl border border-borde/80 bg-white/98 p-2 shadow-[0_20px_44px_-12px_rgba(18,61,112,0.18),0_4px_12px_-2px_rgba(18,61,112,0.06)] backdrop-blur-xl"
                                    >
                                        <div className="flex items-center gap-3 rounded-xl bg-fondo/70 p-2.5">
                                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-marca to-navegacion text-xs font-bold text-white">
                                                {iniciales}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-navegacion">
                                                    {usuario.nombre} {usuario.apellido}
                                                </p>
                                                <p className="truncate text-xs text-texto-suave">
                                                    {usuario.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-2 space-y-0.5">
                                            {esCliente ? (
                                                <Link
                                                    to="/mi-cuenta"
                                                    role="menuitem"
                                                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-texto transition hover:bg-fondo"
                                                >
                                                    <IconoCuenta />
                                                    <span>Mi cuenta</span>
                                                </Link>
                                            ) : null}
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    setMenuCuentaAbierto(false);
                                                    setModalSalirAbierto(true);
                                                }}
                                                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-peligro transition hover:bg-rose-50"
                                            >
                                                <IconoSalir />
                                                <span>Cerrar sesión</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="hidden items-center gap-2 sm:flex">
                                <Link
                                    to="/registro"
                                    className="rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-texto-suave transition hover:bg-fondo hover:text-navegacion"
                                >
                                    Registrarse
                                </Link>
                                <Link
                                    to="/login"
                                    state={{ desde: "/catalogo" }}
                                    className="rounded-full bg-gradient-to-r from-navegacion to-marca-oscura px-4 py-1.5 text-[13.5px] font-semibold text-white shadow-xs transition hover:brightness-110"
                                >
                                    Iniciar sesión
                                </Link>
                            </div>
                        )}

                        <button
                            type="button"
                            aria-expanded={menuMovilAbierto}
                            aria-label={menuMovilAbierto ? "Cerrar menú" : "Abrir menú"}
                            onClick={() => setMenuMovilAbierto((prev) => !prev)}
                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-borde/90 bg-white text-navegacion transition hover:bg-fondo md:hidden"
                        >
                            {menuMovilAbierto ? <IconoCerrar /> : <IconoMenu />}
                        </button>
                    </div>
                </div>

                {/* MENÚ MÓVIL */}
                {menuMovilAbierto ? (
                    <div className="animar-menu border-t border-borde/80 bg-white/98 px-4 py-3 shadow-xl backdrop-blur-xl md:hidden">
                        <nav aria-label="Navegación móvil del cliente" className="space-y-1">
                            <NavLink to={rutaCatalogo} className={claseEnlaceMovil}>
                                Paquetes turísticos
                            </NavLink>

                            {usuario && esCliente ? (
                                <>
                                    <NavLink to="/mis-reservas" className={claseEnlaceMovil}>
                                        Mis reservas
                                    </NavLink>
                                    <NavLink to="/mis-resenias" className={claseEnlaceMovil}>
                                        Publicar reseña
                                    </NavLink>
                                    <NavLink to="/mi-cuenta" className={claseEnlaceMovil}>
                                        Mi cuenta
                                    </NavLink>
                                </>
                            ) : null}

                            {!usuario ? (
                                <div className="mt-2 flex flex-col gap-2 border-t border-borde/80 pt-3">
                                    <Link
                                        to="/login"
                                        state={{ desde: "/catalogo" }}
                                        className="rounded-full bg-gradient-to-r from-navegacion to-marca-oscura px-3 py-2 text-center text-sm font-semibold text-white transition hover:brightness-110"
                                    >
                                        Iniciar sesión
                                    </Link>
                                    <Link
                                        to="/registro"
                                        className="rounded-full border border-borde px-3 py-2 text-center text-sm font-semibold text-navegacion transition hover:bg-fondo"
                                    >
                                        Registrarse
                                    </Link>
                                </div>
                            ) : null}
                        </nav>
                    </div>
                ) : null}
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
                <LimiteDeError>
                    <Suspense fallback={<EstadoListado estado="cargando" />}>
                        {children}
                    </Suspense>
                </LimiteDeError>
            </main>

            <DialogoConfirmacion
                abierto={modalSalirAbierto}
                titulo="¿Deseás cerrar tu sesión?"
                descripcion="Al confirmar, cerrarás tu sesión actual en el portal de clientes de IncaTour."
                textoConfirmar="Sí, salir"
                textoCancelar="Cancelar"
                onConfirmar={confirmarCerrarSesion}
                onCancelar={() => setModalSalirAbierto(false)}
            />
        </div>
    );
}

export default LayoutCliente;
