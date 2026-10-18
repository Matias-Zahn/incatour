import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Alerta from "../components/Alerta";
import Boton from "../components/Boton";
import {
    esquemaLogin,
    useIniciarSesion,
    type DatosLogin,
} from "../services/autenticacionService";
import { obtenerToken, obtenerUsuario } from "../services/sesionService";

function Login() {
    const navegar = useNavigate();
    const ubicacion = useLocation();
    const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? "/";
    const iniciarSesion = useIniciarSesion();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<DatosLogin>({
        resolver: zodResolver(esquemaLogin),
        defaultValues: { email: "", contrasenia: "" },
    });

    useEffect(() => {
        document.title = "Ingresar · IncaTour";
    }, []);

    if (obtenerToken() && obtenerUsuario()?.rol === "ADMIN") {
        return <Navigate to={destino} replace />;
    }

    function enviar(datos: DatosLogin) {
        iniciarSesion.mutate(datos, {
            onSuccess: () => navegar(destino, { replace: true }),
        });
    }

    return (
        <main className="grid min-h-screen place-items-center bg-fondo p-6">
            <form
                onSubmit={handleSubmit(enviar)}
                noValidate
                className="w-full max-w-sm space-y-5 rounded-tarjeta border border-borde bg-white p-8 shadow-tarjeta"
            >
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        IncaTour
                    </p>
                    <h1 className="text-2xl font-bold text-navegacion">Ingresar</h1>
                    <p className="mt-1 text-sm text-texto-suave">
                        Panel administrativo de gestión.
                    </p>
                </div>

                {iniciarSesion.isError ? (
                    <Alerta tipo="error">{iniciarSesion.error.message}</Alerta>
                ) : null}

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Correo electrónico
                    <input
                        type="email"
                        autoComplete="username"
                        {...register("email")}
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                    {errors.email ? (
                        <span role="alert" className="text-xs font-normal text-peligro">
                            {errors.email.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Contraseña
                    <input
                        type="password"
                        autoComplete="current-password"
                        {...register("contrasenia")}
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                    {errors.contrasenia ? (
                        <span role="alert" className="text-xs font-normal text-peligro">
                            {errors.contrasenia.message}
                        </span>
                    ) : null}
                </label>

                <Boton type="submit" className="w-full" cargando={iniciarSesion.isPending}>
                    Ingresar
                </Boton>
            </form>
        </main>
    );
}
export default Login;
