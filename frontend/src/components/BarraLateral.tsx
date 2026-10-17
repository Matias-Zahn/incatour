import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type ElementoNavegacion = {
    etiqueta: string;
    icono: ReactNode;
    ruta?: string;
};

const elementosNavegacion: ElementoNavegacion[] = [
    { etiqueta: "Inicio", icono: "⌂", ruta: "/" },
    { etiqueta: "Circuitos", icono: "⌁", ruta: "/gestion/circuitos" },
    { etiqueta: "Paquetes turísticos", icono: "▣", ruta: "/gestion/paquetes" },
    { etiqueta: "Proveedores", icono: "▱", ruta: "/gestion/proveedores" },
    { etiqueta: "Salidas", icono: "◫" },
    { etiqueta: "Reservas y pagos", icono: "▤", ruta: "/gestion/solicitudes" },
    { etiqueta: "Personal", icono: "♙" },
    { etiqueta: "Reseñas y evaluaciones", icono: "☆", ruta: "/gestion/evaluaciones" },
];

type BarraLateralProps = {
    seccionActiva: string;
};

function BarraLateral({ seccionActiva }: BarraLateralProps) {
    return (
        <aside className="flex w-64 shrink-0 flex-col bg-marca text-white">
            <div className="border-b border-white/20 px-5 py-5">
                <p className="text-lg font-bold leading-tight">IncaTour</p>
                <p className="text-xs text-white/80">Recorridos turísticos</p>
            </div>

            <nav aria-label="Navegación administrativa" className="flex-1 px-3 py-4">
                <ul className="space-y-1">
                    {elementosNavegacion.map((elemento) => (
                        <li key={elemento.etiqueta}>
                            {elemento.ruta ? (
                                <NavLink
                                    to={elemento.ruta}
                                    end={elemento.ruta === "/"}
                                    className={({ isActive }) =>
                                        `flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                                            isActive ||
                                            elemento.etiqueta === seccionActiva
                                                ? "bg-marca-activa text-texto"
                                                : "text-white hover:bg-white/15"
                                        }`
                                    }
                                >
                                    <span
                                        aria-hidden="true"
                                        className="w-5 text-center text-base"
                                    >
                                        {elemento.icono}
                                    </span>
                                    {elemento.etiqueta}
                                </NavLink>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold text-white/60"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="w-5 text-center text-base"
                                    >
                                        {elemento.icono}
                                    </span>
                                    {elemento.etiqueta}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="border-t border-white/20 px-3 py-3">
                <NavLink
                    to="/catalogo?vista=admin"
                    className="flex w-full items-center justify-between rounded-control bg-white/15 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                    <span>👁 Ver tienda como cliente</span>
                    <span aria-hidden="true">↗</span>
                </NavLink>
            </div>

            <div className="border-t border-white/20 px-5 py-4 text-xs text-white/80">
                <p>Usuario de gestión</p>
                <p className="font-semibold text-white">Administrador/a</p>
            </div>
        </aside>
    );
}

export default BarraLateral;
