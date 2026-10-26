import { Navigate, Outlet, useLocation } from "react-router-dom";
import { obtenerToken, obtenerUsuario, type Rol } from "../services/sesionService";

type RutaProtegidaProps = {
    roles: Rol[];
};

function RutaProtegida({ roles }: RutaProtegidaProps) {
    const ubicacion = useLocation();
    const usuario = obtenerUsuario();

    if (!obtenerToken() || !usuario) {
        return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
    }

    // Sesión de otro rol: al inicio de su rol (mandarlo a /login rebotaba sin fin con Login)
    if (!roles.includes(usuario.rol)) {
        const inicio = usuario.rol === "CLIENTE" ? "/catalogo" : usuario.rol === "GUIA" ? "/guia" : "/";
        return <Navigate to={inicio} replace />;
    }

    return <Outlet />;
}

export default RutaProtegida;
