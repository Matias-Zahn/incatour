import { Navigate, Outlet, useLocation } from "react-router-dom";
import { obtenerToken, obtenerUsuario, type Rol } from "../services/sesionService";

type RutaProtegidaProps = {
    roles: Rol[];
};

function RutaProtegida({ roles }: RutaProtegidaProps) {
    const ubicacion = useLocation();
    const usuario = obtenerUsuario();

    if (!obtenerToken() || !usuario || !roles.includes(usuario.rol)) {
        return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
    }

    return <Outlet />;
}

export default RutaProtegida;
