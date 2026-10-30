import type { ReactNode } from "react";
import logoIncaTour from "../../assets/logo-incatour.jpg";
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
    return (
        <aside
            aria-label="Navegación principal del guía"
            className="flex w-64 shrink-0 flex-col bg-[#1b9fc7] p-5 text-white shadow-md max-md:w-full max-md:flex-row max-md:items-center max-md:justify-between max-md:p-3"
        >
            <div className="flex items-center gap-3 border-b border-white/30 pb-4 max-md:border-none max-md:pb-0">
                <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
                    <img
                        src={logoIncaTour}
                        alt="Logo IncaTour"
                        className="size-full object-contain"
                    />
                </div>
                <div>
                    <h2 className="text-xl font-bold leading-none text-white">IncaTour</h2>
                    <p className="mt-1 text-xs text-cyan-100 max-sm:hidden">
                        Portal del Guía
                    </p>
                </div>
            </div>

            {/* En celular la navegación pasa a una barra fija abajo, como en una app */}
            <nav
                aria-label="Secciones del portal"
                className="mt-6 flex-1 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:mt-0 max-md:bg-[#1b9fc7] max-md:px-1 max-md:pt-1 max-md:pb-[max(0.25rem,env(safe-area-inset-bottom))] max-md:shadow-[0_-2px_8px_rgba(0,0,0,0.15)]"
            >
                <ul className="flex flex-col gap-1.5 max-md:flex-row max-md:gap-0">
                    {elementos.map((item) => {
                        const estaActivo = seccionActiva === item.clave;
                        return (
                            <li key={item.clave} className="max-md:flex-1">
                                <button
                                    type="button"
                                    onClick={() => onCambiarSeccion(item.clave)}
                                    aria-label={item.etiqueta}
                                    aria-current={estaActivo ? "page" : undefined}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all max-md:min-h-12 max-md:flex-col max-md:justify-center max-md:gap-0.5 max-md:px-0.5 max-md:py-1.5 ${
                                        estaActivo
                                            ? "bg-[#16d6dc] text-[#075274] shadow-sm"
                                            : "text-white/90 hover:bg-white/15 hover:text-white"
                                    }`}
                                >
                                    <span className="shrink-0">{item.icono}</span>
                                    <span className="max-md:text-xs max-md:leading-tight">
                                        <span className="md:hidden">{item.corta}</span>
                                        <span className="max-md:hidden">{item.etiqueta}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="mt-auto border-t border-white/30 pt-4 max-md:border-none max-md:pt-0">
                <div className="mb-3 text-xs max-md:hidden">
                    <p className="text-cyan-100">Guía asignado</p>
                    <p className="font-bold text-white">
                        {usuario ? `${usuario.nombre} ${usuario.apellido}` : "Carlos Mamani"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onAbrirSalir}
                    aria-label="Salir del portal"
                    className="flex min-h-11 min-w-11 w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20 max-md:w-auto"
                >
                    <IconoSalir tamano={16} />
                    <span className="max-md:hidden">Salir</span>
                </button>
            </div>
        </aside>
    );
}
