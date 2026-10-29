import { useNavigate } from "react-router-dom";
import Boton from "./Boton";
import { IconoSalir } from "../pages/guia/IconosGuia";
import { cerrarSesion } from "../services/autenticacionService";
import { obtenerUsuario } from "../services/sesionService";

type BarraSuperiorProps = {
    seccion: string;
};

function BarraSuperior({ seccion }: BarraSuperiorProps) {
    const navegar = useNavigate();
    const usuario = obtenerUsuario();
    const iniciales = usuario
        ? `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase()
        : "AD";

    function salir() {
        cerrarSesion();
        navegar("/login", { replace: true });
    }

    return (
        <header className="flex min-h-18 items-center justify-between gap-3 border-b border-borde bg-white px-4 md:px-8">
            <div className="min-w-0">
                <p className="text-xs text-texto-suave max-md:hidden">Panel administrativo / Gestión</p>
                <p className="truncate text-sm font-bold uppercase text-navegacion">{seccion}</p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
                <Boton variante="fantasma" className="text-xs" onClick={salir} aria-label="Cerrar sesión">
                    <span className="max-md:hidden">Cerrar sesión</span>
                    <IconoSalir aria-hidden="true" className="md:hidden" />
                </Boton>
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
