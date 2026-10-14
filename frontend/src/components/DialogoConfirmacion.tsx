import { useEffect, useId } from "react";
import Boton from "./Boton";

type DialogoConfirmacionProps = {
    abierto: boolean;
    titulo: string;
    descripcion: string;
    textoConfirmar?: string;
    textoCancelar?: string;
    cargando?: boolean;
    onConfirmar: () => void;
    onCancelar: () => void;
};

function DialogoConfirmacion({
    abierto,
    titulo,
    descripcion,
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar",
    cargando = false,
    onConfirmar,
    onCancelar,
}: DialogoConfirmacionProps) {
    const tituloId = useId();
    const descripcionId = useId();

    useEffect(() => {
        if (!abierto) {
            return;
        }

        function manejarTecla(evento: KeyboardEvent) {
            if (evento.key === "Escape" && !cargando) {
                onCancelar();
            }
        }

        document.addEventListener("keydown", manejarTecla);

        return () => {
            document.removeEventListener("keydown", manejarTecla);
        };
    }, [abierto, cargando, onCancelar]);

    if (!abierto) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget && !cargando) {
                    onCancelar();
                }
            }}
        >
            <section
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={tituloId}
                aria-describedby={descripcionId}
                className="w-full max-w-lg rounded-tarjeta bg-white p-6 shadow-tarjeta"
            >
                <h2 id={tituloId} className="text-xl font-bold text-texto">
                    {titulo}
                </h2>

                <p id={descripcionId} className="mt-3 text-sm leading-6 text-texto-suave">
                    {descripcion}
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <Boton
                        variante="secundario"
                        onClick={onCancelar}
                        disabled={cargando}
                    >
                        {textoCancelar}
                    </Boton>
                    <Boton
                        variante="peligro"
                        onClick={onConfirmar}
                        cargando={cargando}
                    >
                        {textoConfirmar}
                    </Boton>
                </div>
            </section>
        </div>
    );
}

export default DialogoConfirmacion;
