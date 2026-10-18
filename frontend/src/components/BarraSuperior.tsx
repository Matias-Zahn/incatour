import { useNavigate } from "react-router-dom";
import Boton from "./Boton";
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
        <header className="flex min-h-18 items-center justify-between border-b border-borde bg-white px-8">
            <div>
                <p className="text-xs text-texto-suave">Panel administrativo / Gestión</p>
                <p className="text-sm font-bold uppercase text-navegacion">{seccion}</p>
            </div>

            <div className="flex items-center gap-3">
                <Boton variante="fantasma" className="text-xs" onClick={salir}>
                    Cerrar sesión
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
