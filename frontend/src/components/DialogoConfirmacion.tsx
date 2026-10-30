import { useId } from "react";
import Modal from "./Modal";
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

    if (!abierto) {
        return null;
    }

    return (
        <Modal
            onCerrar={onCancelar}
            bloqueado={cargando}
            rol="alertdialog"
            etiquetaId={tituloId}
            descripcionId={descripcionId}
            tamano="sm"
            className="p-6"
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
        </Modal>
    );
}

export default DialogoConfirmacion;
