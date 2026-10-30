import { useState, type ReactNode } from "react";
import {
    Link,
    NavLink,
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

function IconoCuenta() {
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
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
    );
}

function IconoRegistro() {
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
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
    );
}

function IconoSalir() {
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    );
}

function IconoLogin() {
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
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" x2="3" y1="12" y2="12" />
        </svg>
    );
}

function LayoutCliente({ children }: LayoutClienteProps) {
    const navegar = useNavigate();
    const [searchParams] = useSearchParams();
    const [modalSalirAbierto, setModalSalirAbierto] = useState(false);
    // Por defecto barra lateral más chica con iconos estilo Gmail, expandible
    const [colapsada, setColapsada] = useState(true);

    const esVistaPreviaAdmin = searchParams.get("vista") === "admin";
    const tieneToken = Boolean(obtenerToken());
    const usuario = tieneToken ? obtenerUsuario() : null;
    const esCliente = usuario?.rol === "CLIENTE";

    function confirmarCerrarSesion() {
        limpiarSesion();
        setModalSalirAbierto(false);
        navegar("/login", { replace: true });
    }

    const claseElementoSidebar = ({ isActive }: { isActive: boolean }) =>
        `flex w-full items-center ${
            colapsada ? "justify-center px-2 py-3" : "gap-3 px-3.5 py-2.5"
        } rounded-xl text-sm font-semibold transition-all max-md:px-2.5 max-md:py-2 ${
            isActive
                ? "bg-[#16d6dc] text-[#075274] shadow-sm"
                : "text-white/90 hover:bg-white/15 hover:text-white"
        }`;

    return (
        <div className="flex min-h-screen flex-col bg-[#f4f7f8] md:flex-row">
            {/* BARRA LATERAL IZQUIERDA (COLAPSABLE ESTILO GMAIL) */}
            <aside
                aria-label="Navegación principal del cliente"
                className={`flex shrink-0 flex-col bg-[#1b9fc7] text-white shadow-md transition-all duration-300 md:sticky md:top-0 md:h-screen max-md:w-full max-md:flex-row max-md:items-center max-md:justify-between max-md:p-3 ${
                    colapsada ? "md:w-20 md:p-3.5" : "md:w-64 md:p-5"
                }`}
            >
                {/* CABECERA CON LOGO Y BOTÓN DE COLAPSAR/EXPANDIR ESTILO GMAIL */}
                <div
                    className={`flex items-center border-b border-white/30 pb-4 max-md:border-none max-md:pb-0 ${
                        colapsada
                            ? "flex-col justify-center gap-2"
                            : "justify-between"
                    }`}
                >
                    <Link
                        to={
                            esVistaPreviaAdmin
                                ? "/catalogo?vista=admin"
                                : "/catalogo"
                        }
                        className="flex items-center gap-3"
                        title="IncaTour - Inicio"
                    >
                        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm transition hover:scale-105">
                            <img
                                src={logoIncaTour}
                                alt="Logo IncaTour"
                                className="size-full object-contain"
                            />
                        </div>
                        {!colapsada ? (
                            <div>
                                <h2 className="text-xl font-bold leading-none text-white">
                                    IncaTour
                                </h2>
                                <p className="mt-1 text-xs text-cyan-100 max-sm:hidden">
                                    Portal del Cliente
                                </p>
                            </div>
                        ) : null}
                    </Link>

                    <button
                        type="button"
                        onClick={() => setColapsada(!colapsada)}
                        className="hidden rounded-lg p-2 text-white/90 transition hover:bg-white/20 hover:text-white md:inline-flex"
                        title={
                            colapsada
                                ? "Expandir menú lateral"
                                : "Colapsar menú lateral"
                        }
                        aria-label={
                            colapsada
                                ? "Expandir menú lateral"
                                : "Colapsar menú lateral"
                        }
                    >
                        <IconoMenu />
                    </button>
                </div>

                {/* NAVEGACIÓN */}
                <nav
                    aria-label="Secciones del portal del cliente"
                    className="mt-6 flex-1 max-md:mt-0 max-md:flex max-md:overflow-x-auto"
                >
                    <ul className="flex flex-col gap-1.5 max-md:flex-row max-md:gap-1">
                        <li>
                            <NavLink
                                to={
                                    esVistaPreviaAdmin
                                        ? "/catalogo?vista=admin"
                                        : "/catalogo"
                                }
                                className={claseElementoSidebar}
                                title="Paquetes turísticos"
                            >
                                <span className="shrink-0">
                                    <IconoPaquetes />
                                </span>
                                {!colapsada ? (
                                    <span className="max-md:hidden">
                                        Paquetes turísticos
                                    </span>
                                ) : null}
                            </NavLink>
                        </li>

                        {/* SOLO SE MUESTRAN CUENTA, RESEÑA Y RESERVAS SI EL USUARIO TIENE SESIÓN INICIADA COMO CLIENTE */}
                        {usuario && esCliente ? (
                            <>
                                <li>
                                    <NavLink
                                        to="/mis-reservas"
                                        className={claseElementoSidebar}
                                        title="Mis reservas"
                                    >
                                        <span className="shrink-0">
                                            <IconoReservas />
                                        </span>
                                        {!colapsada ? (
                                            <span className="max-md:hidden">
                                                Mis reservas
                                            </span>
                                        ) : null}
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink
                                        to="/mis-resenias"
                                        className={claseElementoSidebar}
                                        title="Publicar reseña"
                                    >
                                        <span className="shrink-0">
                                            <IconoResenias />
                                        </span>
                                        {!colapsada ? (
                                            <span className="max-md:hidden">
                                                Publicar reseña
                                            </span>
                                        ) : null}
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink
                                        to="/mi-cuenta"
                                        className={claseElementoSidebar}
                                        title="Cuenta"
                                    >
                                        <span className="shrink-0">
                                            <IconoCuenta />
                                        </span>
                                        {!colapsada ? (
                                            <span className="max-md:hidden">
                                                Cuenta
                                            </span>
                                        ) : null}
                                    </NavLink>
                                </li>
                            </>
                        ) : null}

                        {!usuario ? (
                            <li>
                                <NavLink
                                    to="/registro"
                                    className={claseElementoSidebar}
                                    title="Registrarse"
                                >
                                    <span className="shrink-0">
                                        <IconoRegistro />
                                    </span>
                                    {!colapsada ? (
                                        <span className="max-md:hidden">
                                            Registrarse
                                        </span>
                                    ) : null}
                                </NavLink>
                            </li>
                        ) : null}
                    </ul>
                </nav>

                {/* FOOTER DEL SIDEBAR */}
                <div className="mt-auto border-t border-white/30 pt-4 max-md:border-none max-md:pt-0">
                    {usuario ? (
                        <>
                            {!colapsada ? (
                                <div className="mb-3 text-xs max-md:hidden">
                                    <p className="text-cyan-100">
                                        {usuario.rol === "CLIENTE"
                                            ? "Cliente registrado"
                                            : `Perfil ${usuario.rol}`}
                                    </p>
                                    <p className="font-bold text-white">
                                        {usuario.nombre} {usuario.apellido}
                                    </p>
                                    <p className="truncate text-[11px] text-cyan-100/90">
                                        {usuario.email}
                                    </p>
                                </div>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => setModalSalirAbierto(true)}
                                className={`flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 text-xs font-bold text-white transition hover:bg-white/20 max-md:w-auto ${
                                    colapsada
                                        ? "w-full py-2.5"
                                        : "w-full px-3 py-2"
                                }`}
                                title={`Cerrar sesión (${usuario.nombre})`}
                            >
                                <IconoSalir />
                                {!colapsada ? (
                                    <span className="max-md:hidden">Salir</span>
                                ) : null}
                            </button>
                        </>
                    ) : (
                        <div className="space-y-2">
                            {!colapsada ? (
                                <div className="text-xs max-md:hidden">
                                    <p className="text-cyan-100">Visitante</p>
                                    <p className="font-bold text-white">
                                        Sin sesión activa
                                    </p>
                                </div>
                            ) : null}
                            <Link
                                to="/login"
                                state={{ desde: "/catalogo" }}
                                className={`flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white text-xs font-bold text-[#07395d] shadow-xs transition hover:bg-cyan-50 max-md:w-auto ${
                                    colapsada
                                        ? "w-full py-2.5"
                                        : "w-full px-3 py-2"
                                }`}
                                title="Iniciar sesión"
                            >
                                {colapsada ? (
                                    <IconoLogin />
                                ) : (
                                    <span>Iniciar sesión</span>
                                )}
                            </Link>
                        </div>
                    )}
                </div>
            </aside>

            {/* ÁREA DE CONTENIDO DERECHA */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* BANNER DE VISTA PREVIA CUANDO EL ADMIN ENTRA A VER CÓMO LO VE EL CLIENTE */}
                {esVistaPreviaAdmin || usuario?.rol === "ADMIN" ? (
                    <div className="border-b border-marca-oscura bg-navegacion px-6 py-2.5 text-xs text-white">
                        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="rounded bg-marca px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                                    Vista previa de Administrador
                                </span>
                                <span className="text-white/90">
                                    Estás visualizando el portal del cliente.
                                    Para reservar, cancelar o reseñar, ingresá
                                    con una cuenta de perfil CLIENTE.
                                </span>
                            </div>

                            <Link
                                to="/gestion/paquetes"
                                className="inline-flex items-center gap-1.5 rounded-control bg-white/15 px-3 py-1 font-semibold text-white transition hover:bg-white/25"
                            >
                                ← Volver al Panel de Gestión
                            </Link>
                        </div>
                    </div>
                ) : null}

                <main className="flex-1 overflow-x-hidden p-4 md:p-8">
                    <div className="mx-auto max-w-6xl"><LimiteDeError>{children}</LimiteDeError></div>
                </main>
            </div>

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
