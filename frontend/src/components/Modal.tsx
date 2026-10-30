import { useLayoutEffect, useRef, type ReactNode } from "react";

type ModalProps = {
    onCerrar: () => void;
    /** Impide cerrar con Escape o con clic en el fondo, por ejemplo durante un envío */
    bloqueado?: boolean;
    /** id del título del modal; sin título visible, usar `etiqueta` */
    etiquetaId?: string;
    etiqueta?: string;
    descripcionId?: string;
    rol?: "dialog" | "alertdialog";
    /** sm queda centrado también en celular; los demás ocupan toda la pantalla */
    tamano?: "sm" | "md" | "lg" | "xl";
    className?: string;
    children: ReactNode;
};

const anchoPorTamano = {
    sm: "max-w-lg",
    md: "max-w-2xl",
    lg: "max-w-3xl",
    xl: "max-w-4xl",
};

// <dialog> con showModal() ya atrapa el foco, lo devuelve al cerrar y deja inerte la página de atrás.
// El elemento ocupa toda la pantalla y hace de fondo; el panel va adentro para detectar el clic afuera.
function Modal({
    onCerrar,
    bloqueado = false,
    etiquetaId,
    etiqueta,
    descripcionId,
    rol = "dialog",
    tamano = "md",
    className = "",
    children,
}: ModalProps) {
    const dialogo = useRef<HTMLDialogElement>(null);

    // Layout: el cierre tiene que correr con el <dialog> todavía en el DOM para que el foco vuelva a su lugar
    useLayoutEffect(() => {
        const elemento = dialogo.current;
        const scrollPrevio = document.body.style.overflow;
        elemento?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            elemento?.close();
            document.body.style.overflow = scrollPrevio;
        };
    }, []);

    const pantallaCompleta = tamano !== "sm";

    return (
        <dialog
            ref={dialogo}
            role={rol}
            aria-labelledby={etiquetaId}
            aria-label={etiqueta}
            aria-describedby={descripcionId}
            onCancel={(evento) => {
                evento.preventDefault();
                if (!bloqueado) onCerrar();
            }}
            // Chrome cierra igual con el segundo Escape seguido, aunque se cancele el primero
            onClose={() => {
                const elemento = dialogo.current;
                // El close del desmontaje llega tarde: sin elemento, o ya reabierto, no es un cierre del usuario
                if (!elemento || elemento.open) return;
                if (bloqueado) elemento.showModal();
                else onCerrar();
            }}
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget && !bloqueado) onCerrar();
            }}
            className={`fixed inset-0 m-0 flex size-full max-h-none max-w-none items-center justify-center border-0 bg-slate-950/50 text-texto ${pantallaCompleta ? "p-0 md:p-4" : "p-4"}`}
        >
            <div
                className={`w-full overflow-y-auto bg-white shadow-tarjeta ${anchoPorTamano[tamano]} ${pantallaCompleta ? "h-full md:h-auto md:max-h-[90vh] md:rounded-tarjeta" : "max-h-full rounded-tarjeta"} ${className}`}
            >
                {children}
            </div>
        </dialog>
    );
}

export default Modal;
