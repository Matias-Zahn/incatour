import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import { cuentasMock, generarTokenMock } from "../autorizacion";

export const manejadoresAutenticacion = [
    http.post(construirUrl("/auth/login"), async ({ request }) => {
        await delay();
        const { email, contrasenia } = (await request.json()) as {
            email?: string;
            contrasenia?: string;
        };
        const cuenta = cuentasMock.find(
            (item) => item.usuario.email === email && item.contrasenia === contrasenia,
        );
        if (!cuenta) {
            return HttpResponse.json(
                { error: "Credenciales inválidas o cuenta inactiva." },
                { status: 401 },
            );
        }
        return HttpResponse.json({
            data: {
                usuario: cuenta.usuario,
                token: generarTokenMock(cuenta.usuario.rol),
            },
        });
    }),
];
