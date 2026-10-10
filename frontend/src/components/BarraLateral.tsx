import type { ReactNode } from "react";

type ElementoNavegacion = {
    etiqueta: string;
    icono: ReactNode;
};

const elementosNavegacion: ElementoNavegacion[] = [
    { etiqueta: "Inicio", icono: "⌂" },
    { etiqueta: "Circuitos", icono: "⌁" },
    { etiqueta: "Paquetes turísticos", icono: "▣" },
    { etiqueta: "Proveedores", icono: "▱" },
    { etiqueta: "Salidas", icono: "◫" },
    { etiqueta: "Reservas y pagos", icono: "▤" },
    { etiqueta: "Personal", icono: "♙" },
    { etiqueta: "Reseñas y evaluaciones", icono: "☆" },
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
                            <button
                                type="button"
                                className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                                    elemento.etiqueta === seccionActiva
                                        ? "bg-marca-activa text-texto"
                                        : "text-white hover:bg-white/15"
                                }`}
                            >
                                <span aria-hidden="true" className="w-5 text-center text-base">
                                    {elemento.icono}
                                </span>
                                {elemento.etiqueta}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="border-t border-white/20 px-5 py-4 text-xs text-white/80">
                <p>Usuario de gestión</p>
                <p className="font-semibold text-white">Administrador/a</p>
            </div>
        </aside>
    );
}

export default BarraLateral;
