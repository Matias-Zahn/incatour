import type { ButtonHTMLAttributes } from "react";

type BotonVariante = "principal" | "secundario" | "peligro" | "fantasma";

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variante?: BotonVariante;
    cargando?: boolean;
};

const estilosPorVariante: Record<BotonVariante, string> = {
    principal:
        "bg-primario text-white hover:bg-marca-oscura focus-visible:outline-marca",
    secundario:
        "border border-borde bg-white text-texto hover:bg-fondo focus-visible:outline-marca",
    peligro:
        "bg-peligro text-white hover:bg-peligro/90 focus-visible:outline-peligro",
    fantasma:
        "bg-transparent text-texto hover:bg-fondo focus-visible:outline-marca",
};

function Boton({
    variante = "principal",
    cargando = false,
    children,
    disabled,
    className = "",
    ...props
}: BotonProps) {
    return (
        <button
            type="button"
            aria-busy={cargando}
            disabled={disabled || cargando}
            className={`inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${estilosPorVariante[variante]} ${className}`}
            {...props}
        >
            {cargando ? "Procesando..." : children}
        </button>
    );
}

export default Boton;
