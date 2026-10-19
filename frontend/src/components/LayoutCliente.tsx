import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
    limpiarSesion,
    obtenerToken,
    obtenerUsuario,
} from "../services/sesionService";

type LayoutClienteProps = {
    children: ReactNode;
};

function LayoutCliente({ children }: LayoutClienteProps) {
    const navegar = useNavigate();
    const [searchParams] = useSearchParams();
    const esVistaPreviaAdmin = searchParams.get("vista") === "admin";
    const tieneToken = Boolean(obtenerToken());
    const usuario = tieneToken ? obtenerUsuario() : null;

    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "IT";

    function manejarCerrarSesion() {
        limpiarSesion();
        navegar("/login");
    }

    return (
        <div className="flex min-h-screen flex-col bg-fondo">
            {/* BANNER DE VISTA PREVIA CUANDO EL ADMIN ENTRA A VER CÓMO LO VE EL CLIENTE */}
            {esVistaPreviaAdmin || usuario?.rol === "ADMIN" ? (
                <div className="border-b border-marca-oscura bg-navegacion px-4 py-2.5 text-xs text-white">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="rounded bg-marca px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                                Vista previa de Administrador
                            </span>
                            <span className="text-white/90">
                                Estás visualizando el catálogo público (CU-26) y
                                el flujo de compra (CU-30) como lo ve el
                                cliente. Para comprar, ingresá con una cuenta de
                                perfil CLIENTE.
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

            {/* BARRA SUPERIOR DEL PORTAL DEL CLIENTE */}
            <header className="border-b border-borde bg-white shadow-xs">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-6">
                        <Link
                            to={
                                esVistaPreviaAdmin
                                    ? "/catalogo?vista=admin"
                                    : "/catalogo"
                            }
                            className="flex items-center gap-3"
                        >
                            <div className="grid size-10 place-items-center rounded-control bg-marca text-lg font-bold text-white shadow-xs">
                                IT
                            </div>
                            <div>
                                <p className="text-lg font-bold leading-tight text-navegacion">
                                    IncaTour
                                </p>
                                <p className="text-xs text-texto-suave">
                                    Expediciones y Camino del Inca
                                </p>
                            </div>
                        </Link>

                        <nav
                            aria-label="Navegación del portal de clientes"
                            className="hidden items-center gap-4 border-l border-borde pl-6 text-sm font-semibold text-texto md:flex"
                        >
                            <Link
                                to={
                                    esVistaPreviaAdmin
                                        ? "/catalogo?vista=admin"
                                        : "/catalogo"
                                }
                                className="rounded-control bg-marca-activa px-3 py-1.5 text-marca-oscura"
                            >
                                {esVistaPreviaAdmin || usuario?.rol === "ADMIN"
                                    ? "Catálogo público (CU-26)"
                                    : "Catálogo de paquetes"}
                            </Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        {usuario ? (
                            <>
                                <div className="flex items-center gap-2.5 rounded-full border border-borde bg-fondo/70 px-3.5 py-1.5">
                                    <span className="grid size-7 place-items-center rounded-full bg-marca text-xs font-bold text-white">
                                        {iniciales}
                                    </span>
                                    <div className="text-left text-xs">
                                        <p className="font-bold leading-tight text-navegacion">
                                            {usuario.nombre} {usuario.apellido}
                                        </p>
                                        <p className="text-[11px] text-texto-suave">
                                            Perfil: {usuario.rol}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={manejarCerrarSesion}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-xs font-semibold text-texto-suave transition hover:bg-fondo hover:text-navegacion"
                                >
                                    Cerrar sesión
                                </button>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                state={{ desde: "/catalogo" }}
                                className="rounded-control bg-marca px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-marca-oscura"
                            >
                                Iniciar sesión
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* CONTENIDO PRINCIPAL DEL CLIENTE */}
            <main className="flex-1 px-6 py-8">{children}</main>

            {/* PIE DE PÁGINA COMERCIAL */}
            <footer className="border-t border-borde bg-white px-6 py-5 text-xs text-texto-suave">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                    <p>
                        <strong className="text-navegacion">IncaTour</strong> ·
                        Operador oficial autorizado en Cusco y Camino del Inca.
                    </p>
                    <p>
                        Reserva inmediata con bloqueo de cupo ante la autoridad
                        y pasarela segura.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default LayoutCliente;
