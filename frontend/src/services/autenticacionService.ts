import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";
import { guardarSesion, limpiarSesion, type UsuarioSesion } from "./sesionService";

export const esquemaLogin = z.object({
    email: z.string().trim().min(1, "El correo es obligatorio.").email("Ingresá un correo válido."),
    contrasenia: z.string().min(1, "La contraseña es obligatoria."),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;

type RespuestaLogin = { data: { usuario: UsuarioSesion; token: string } };

export async function iniciarSesion(datos: DatosLogin): Promise<UsuarioSesion> {
    const { data: { usuario, token } } = await solicitarApi<RespuestaLogin>("/auth/login", {
        method: "POST",
        body: JSON.stringify(datos),
    });
    guardarSesion(token, usuario);
    return usuario;
}

export function cerrarSesion(): void {
    limpiarSesion();
}

export function useIniciarSesion() {
    return useMutation({ mutationFn: iniciarSesion });
}
