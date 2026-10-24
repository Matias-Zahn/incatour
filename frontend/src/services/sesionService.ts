export type Rol = "ADMIN" | "CLIENTE" | "GUIA";

export type UsuarioSesion = {
    idusuario: number;
    email: string;
    nombre: string;
    apellido: string;
    rol: Rol;
};

const CLAVE_TOKEN = "incatour.token";
const CLAVE_USUARIO = "incatour.usuario";
const CLAVE_IDCLIENTE = "incatour.idcliente";

export function obtenerToken(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
}

export function obtenerUsuario(): UsuarioSesion | null {
    const crudo = localStorage.getItem(CLAVE_USUARIO);
    if (!crudo) return null;
    try {
        return JSON.parse(crudo) as UsuarioSesion;
    } catch {
        return null;
    }
}

export function guardarSesion(token: string, usuario: UsuarioSesion): void {
    const usuarioPrevio = obtenerUsuario();
    if (usuarioPrevio && usuarioPrevio.idusuario !== usuario.idusuario) {
        localStorage.removeItem(CLAVE_IDCLIENTE);
    }
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function limpiarSesion(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_IDCLIENTE);
}
