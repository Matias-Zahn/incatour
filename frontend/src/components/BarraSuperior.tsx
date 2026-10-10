type BarraSuperiorProps = {
    seccion: string;
};

function BarraSuperior({ seccion }: BarraSuperiorProps) {
    return (
        <header className="flex min-h-18 items-center justify-between border-b border-borde bg-white px-8">
            <div>
                <p className="text-xs text-texto-suave">Panel administrativo / Gestión</p>
                <p className="text-sm font-bold uppercase text-navegacion">{seccion}</p>
            </div>

            <div
                aria-label="Usuario administrador"
                className="grid size-10 place-items-center rounded-full bg-marca-suave font-bold text-marca-oscura"
            >
                AD
            </div>
        </header>
    );
}

export default BarraSuperior;
