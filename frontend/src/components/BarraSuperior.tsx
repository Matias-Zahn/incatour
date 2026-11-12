import { obtenerUsuario } from "../services/sesionService";

type BarraSuperiorProps = {
    seccion: string;
};

function BarraSuperior({ seccion }: BarraSuperiorProps) {
    const usuario = obtenerUsuario();
    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "AD";

    return (
        <header className="flex min-h-18 items-center justify-between gap-3 border-b border-borde bg-white px-4 md:px-8">
            <div className="min-w-0">
                <p className="text-xs text-texto-suave max-md:hidden">Panel administrativo / Gestión</p>
                <p className="truncate text-sm font-bold uppercase text-navegacion">{seccion}</p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
                <div
                    aria-label="Usuario administrador"
                    className="grid size-10 place-items-center rounded-full bg-marca-suave font-bold text-marca-oscura"
                >
                    {iniciales}
                </div>
            </div>
        </header>
    );
}

export default BarraSuperior;
