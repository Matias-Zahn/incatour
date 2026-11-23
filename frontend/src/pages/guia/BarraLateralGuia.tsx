import type { ReactNode } from "react";
import logoIncaTour from "../../assets/logo-incatour.png";
import {
    IconoCalendario,
    IconoCampana,
    IconoEscudoAlerta,
    IconoInicio,
    IconoMapa,
    IconoSalir,
} from "./IconosGuia";
import type { UsuarioSesion } from "../../services/sesionService";

export type SeccionGuia =
    | "inicio"
    | "salidas"
    | "recorridos"
    | "novedades"
    | "incidentes";

type BarraLateralGuiaProps = {
    seccionActiva: SeccionGuia;
    onCambiarSeccion: (seccion: SeccionGuia) => void;
    onAbrirSalir: () => void;
    usuario: UsuarioSesion | null;
};

type ElementoNav = {
    clave: SeccionGuia;
    etiqueta: string;
    // Etiqueta de la barra inferior en celular
    corta: string;
    icono: ReactNode;
};

const elementos: ElementoNav[] = [
    { clave: "inicio", etiqueta: "Inicio", corta: "Inicio", icono: <IconoInicio /> },
    { clave: "salidas", etiqueta: "Mis salidas", corta: "Salidas", icono: <IconoCalendario /> },
    { clave: "recorridos", etiqueta: "Recorridos", corta: "Recorrido", icono: <IconoMapa /> },
    { clave: "novedades", etiqueta: "Novedades", corta: "Novedades", icono: <IconoCampana /> },
    { clave: "incidentes", etiqueta: "Incidentes", corta: "Incidentes", icono: <IconoEscudoAlerta /> },
];

export function BarraLateralGuia({
    seccionActiva,
    onCambiarSeccion,
    onAbrirSalir,
    usuario,
}: BarraLateralGuiaProps) {
    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "GU";

    return (
        <>
            <header
                aria-label="Navegación principal del guía"
                className="sticky top-0 z-40 border-b border-borde/80 bg-white/80 shadow-[0_1px_2px_rgba(18,61,112,0.04)] backdrop-blur-xl"
            >
                <div
                    aria-hidden="true"
                    className="h-[2px] w-full bg-gradient-to-r from-navegacion via-marca to-[#16d6dc]"
                />

                <div className="mx-auto flex h-15 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex shrink-0 items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-navegacion/10">
                            <img
                                src={logoIncaTour}
                                alt="Logo IncaTour"
                                className="size-full object-contain"
                            />
                        </div>
                        <span className="text-[15px] font-bold tracking-[-0.02em] text-navegacion">
                            IncaTour
                        </span>
                        <span className="rounded-full bg-navegacion/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-tight text-navegacion/75">
                            Guía
                        </span>
                    </div>

                    <nav
                        aria-label="Secciones del portal"
                        className="hidden items-center gap-0.5 rounded-full bg-fondo/95 p-1 ring-1 ring-borde/80 md:flex"
                    >
                        {elementos.map((item) => {
                            const estaActivo = seccionActiva === item.clave;
                            return (
                                <button
                                    key={item.clave}
                                    type="button"
                                    onClick={() => onCambiarSeccion(item.clave)}
                                    aria-current={estaActivo ? "page" : undefined}
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] tracking-[-0.01em] transition-all ${
                                        estaActivo
                                            ? "bg-white font-semibold text-navegacion shadow-[0_1px_3px_rgba(18,61,112,0.10)] ring-1 ring-navegacion/[0.06]"
                                            : "font-medium text-texto-suave hover:bg-white/60 hover:text-navegacion"
                                    }`}
                                >
                                    <span>{item.etiqueta}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="flex shrink-0 items-center gap-2.5">
                        <div className="hidden items-center gap-2 sm:flex">
                            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-navegacion to-marca-oscura text-[11px] font-bold text-white shadow-2xs">
                                {iniciales}
                            </span>
                            <span className="max-w-32 truncate text-xs font-semibold text-navegacion lg:inline hidden">
                                {usuario ? `${usuario.nombre} ${usuario.apellido}` : "Guía"}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onAbrirSalir}
                            aria-label="Cerrar sesión"
                            title="Cerrar sesión"
                            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-borde/90 bg-white px-3 py-1.5 text-xs font-semibold text-texto transition hover:border-peligro/40 hover:bg-rose-50 hover:text-peligro"
                        >
                            <IconoSalir tamano={14} />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* En celular la navegación pasa a una barra fija abajo, estilo dock moderno */}
            <nav
                aria-label="Secciones del portal móvil"
                className="fixed inset-x-0 bottom-0 z-30 border-t border-borde/80 bg-white/90 px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-4px_20px_rgba(18,61,112,0.08)] md:hidden"
            >
                <ul className="flex flex-row gap-1">
                    {elementos.map((item) => {
                        const estaActivo = seccionActiva === item.clave;
                        return (
                            <li key={item.clave} className="flex-1">
                                <button
                                    type="button"
                                    onClick={() => onCambiarSeccion(item.clave)}
                                    aria-label={item.etiqueta}
                                    aria-current={estaActivo ? "page" : undefined}
                                    className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition ${
                                        estaActivo
                                            ? "bg-marca-suave/85 text-navegacion"
                                            : "text-texto-suave hover:text-navegacion"
                                    }`}
                                >
                                    <span className="shrink-0">{item.icono}</span>
                                    <span className="leading-tight">{item.corta}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </>
    );
}
