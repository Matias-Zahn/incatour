import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
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

    const usuarioActual = obtenerUsuario();
    if (obtenerToken() && usuarioActual) {
        const rutaPorRol =
            usuarioActual.rol === "CLIENTE"
                ? "/catalogo"
                : usuarioActual.rol === "GUIA"
                  ? "/guia"
                  : "/";
        return (
            <Navigate
                to={destino !== "/" ? destino : rutaPorRol}
                replace
            />
        );
    }

    function enviar(datos: DatosLogin) {
        iniciarSesion.mutate(datos, {
            onSuccess: (usuario) => {
                const rutaPorRol =
                    usuario.rol === "CLIENTE"
                        ? "/catalogo"
                        : usuario.rol === "GUIA"
                          ? "/guia"
                          : "/";
                navegar(destino !== "/" ? destino : rutaPorRol, {
                    replace: true,
                });
            },
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
                        Portal de acceso IncaTour.
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

                <div className="space-y-2 border-t border-borde pt-4 text-center text-xs text-texto-suave">
                    <p>
                        ¿No tenés una cuenta?{" "}
                        <Link
                            to="/registro"
                            className="font-bold text-marca hover:underline"
                        >
                            Registrate como cliente
                        </Link>
                    </p>
                    <p>
                        <Link
                            to="/catalogo"
                            className="font-semibold text-navegacion hover:underline"
                        >
                            Explorar catálogo público →
                        </Link>
                    </p>
                </div>
            </form>
        </main>
    );
}

export default Login;
