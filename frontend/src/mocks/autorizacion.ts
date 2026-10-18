import { HttpResponse } from "msw";
import type { Rol, UsuarioSesion } from "../services/sesionService";

export type CuentaMock = { usuario: UsuarioSesion; contrasenia: string };

export const cuentasMock: CuentaMock[] = [
    {
        contrasenia: "AdminIncaTour123",
        usuario: { idusuario: 1, email: "admin@incatour.com", nombre: "Admin", apellido: "IncaTour", rol: "ADMIN" },
    },
    {
        contrasenia: "hash123",
        usuario: { idusuario: 2, email: "juan@test.com", nombre: "Juan", apellido: "Pérez", rol: "CLIENTE" },
    },
    {
        contrasenia: "guia123",
        usuario: { idusuario: 3, email: "carlos.guia@incatour.com", nombre: "Carlos", apellido: "Mamani", rol: "GUIA" },
    },
];

/** El token mock lleva el rol: `mock.<ROL>`. */
export const generarTokenMock = (rol: Rol) => `mock.${rol}`;

/**
 * Replica el control de acceso del back: 401 sin token válido, 403 si el
 * perfil no coincide. Devuelve una respuesta de error o null si pasa.
 */
export function exigirRol(request: Request, rol: Rol): Response | null {
    const encabezado = request.headers.get("Authorization") ?? "";
    const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : "";
    const rolToken = token.startsWith("mock.") ? token.slice(5) : null;
    if (!rolToken) {
        return HttpResponse.json({ error: "Token no proporcionado o inválido." }, { status: 401 });
    }
    if (rolToken !== rol) {
        return HttpResponse.json({ error: `Se requiere el perfil ${rol}.` }, { status: 403 });
    }
    return null;
}
