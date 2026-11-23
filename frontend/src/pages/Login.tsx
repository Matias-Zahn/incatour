import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Alerta from "../components/Alerta";
import logoIncaTour from "../assets/logo-incatour.png";
import portadaMachuPicchu from "../assets/portada-machu-picchu.jpg";
import {
    esquemaLogin,
    useIniciarSesion,
    type DatosLogin,
} from "../services/autenticacionService";
import { obtenerToken, obtenerUsuario } from "../services/sesionService";

function IconoCorreo() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    );
}

function IconoCandado() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function IconoOjo({ tachado }: { tachado: boolean }) {
    if (tachado) {
        return (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                <path d="m2 2 20 20" />
            </svg>
        );
    }
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function IconoBrujula() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
    );
}

function IconoViajero() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

function IconoPanel() {
    return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
    );
}

function Login() {
    const navegar = useNavigate();
    const ubicacion = useLocation();
    // FE-48: el destino también puede venir en ?desde= (recarga por sesión vencida); solo rutas internas
    const desdeQuery = new URLSearchParams(ubicacion.search).get("desde");
    const destino =
        (ubicacion.state as { desde?: string } | null)?.desde ??
        (desdeQuery?.startsWith("/") && !desdeQuery.startsWith("//") ? desdeQuery : "/");
    const iniciarSesion = useIniciarSesion();
    const [verContrasenia, setVerContrasenia] = useState(false);
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
        <main className="grid min-h-screen bg-white lg:grid-cols-12">
            {/* PANEL IZQUIERDO EDITORIAL (DESKTOP) */}
            <section
                aria-label="Presentación de IncaTour"
                className="relative hidden overflow-hidden bg-navegacion lg:col-span-7 lg:flex lg:flex-col lg:justify-between"
            >
                <img
                    src={portadaMachuPicchu}
                    alt="Ciudadela de Machu Picchu al amanecer en los Andes peruanos"
                    className="absolute inset-0 size-full object-cover object-center scale-[1.01]"
                />
                {/* Capas de contraste cinematográfico para que la foto respire y el texto sea impecable */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#081c36]/95 via-[#0e2e56]/55 to-[#081c36]/45"
                />
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-[#081c36]/60 via-transparent to-transparent"
                />

                {/* CABECERA DEL PANEL */}
                <div className="relative z-10 flex items-center justify-between p-10">
                    <Link
                        to="/catalogo"
                        className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 py-1.5 pl-2 pr-4 backdrop-blur-md transition hover:bg-white/15"
                    >
                        <div className="grid size-8 place-items-center overflow-hidden rounded-full bg-white shadow-xs">
                            <img
                                src={logoIncaTour}
                                alt="Logo IncaTour"
                                className="size-full object-contain"
                            />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-white">
                            IncaTour
                        </span>
                        <span className="h-3.5 w-px bg-white/30" aria-hidden="true" />
                        <span className="text-xs font-medium text-cyan-100/90">
                            Cusco, Perú
                        </span>
                    </Link>

                    <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-md">
                        Camino Inca · Salkantay · Lares
                    </span>
                </div>

                {/* CONTENIDO INFERIOR: CONTEXTO CLARO DE LA PLATAFORMA */}
                <div className="relative z-10 max-w-2xl space-y-6 p-10">
                    <div className="space-y-3">
                        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-marca/25 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100 backdrop-blur-md">
                            <span className="size-1.5 rounded-full bg-[#16d6dc]" aria-hidden="true" />
                            Plataforma oficial de expediciones
                        </p>
                        <h2 className="text-4xl font-bold leading-[1.12] tracking-tight text-white xl:text-[42px]">
                            Expediciones a Machu Picchu y los Andes, de punta a punta.
                        </h2>
                        <p className="max-w-xl text-[15px] leading-relaxed text-white/80">
                            Un único acceso para toda la operación de IncaTour: según tu cuenta, ingresás directo a tus reservas de viaje, al portal de guías en ruta o al panel de gestión.
                        </p>
                    </div>

                    {/* RESUMEN VISUAL DE LOS 3 PORTALES */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                            <div className="mb-2 inline-flex size-7 items-center justify-center rounded-lg bg-white/15 text-cyan-200">
                                <IconoViajero />
                            </div>
                            <p className="text-xs font-bold text-white">Viajeros</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-white/75">
                                Comprá paquetes, seguí tus reservas y dejá reseñas.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                            <div className="mb-2 inline-flex size-7 items-center justify-center rounded-lg bg-white/15 text-cyan-200">
                                <IconoBrujula />
                            </div>
                            <p className="text-xs font-bold text-white">Guías</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-white/75">
                                Iniciá salidas, cargá avances e incidentes en vivo.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                            <div className="mb-2 inline-flex size-7 items-center justify-center rounded-lg bg-white/15 text-cyan-200">
                                <IconoPanel />
                            </div>
                            <p className="text-xs font-bold text-white">Gestión</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-white/75">
                                Programá salidas, hoteles, stock y reportes.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* PANEL DERECHO: FORMULARIO LIMPIO */}
            <section className="flex min-h-screen flex-col justify-between bg-fondo/40 lg:col-span-5 lg:bg-white">
                {/* BANNER COMPACTO EN CELULAR */}
                <div className="relative overflow-hidden bg-navegacion px-5 py-6 text-white lg:hidden">
                    <img
                        src={portadaMachuPicchu}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 size-full object-cover opacity-35"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-r from-[#081c36]/90 to-[#123d70]/70"
                    />
                    <div className="relative z-10 flex items-center justify-between gap-3">
                        <Link to="/catalogo" className="flex items-center gap-2.5">
                            <div className="grid size-9 place-items-center overflow-hidden rounded-xl bg-white shadow-xs">
                                <img
                                    src={logoIncaTour}
                                    alt="Logo IncaTour"
                                    className="size-full object-contain"
                                />
                            </div>
                            <div>
                                <p className="text-base font-bold leading-tight text-white">
                                    IncaTour
                                </p>
                                <p className="text-[11px] text-cyan-100/90">
                                    Expediciones · Camino Inca
                                </p>
                            </div>
                        </Link>
                        <Link
                            to="/catalogo"
                            className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                        >
                            Ver catálogo →
                        </Link>
                    </div>
                </div>

                {/* BARRA SUPERIOR DERECHA (DESKTOP) */}
                <div className="hidden items-center justify-end px-8 pt-7 lg:flex">
                    <Link
                        to="/catalogo"
                        className="inline-flex items-center gap-1.5 rounded-full border border-borde bg-white px-3.5 py-1.5 text-xs font-semibold text-navegacion transition hover:border-marca/45 hover:bg-marca-suave/50"
                    >
                        <span>Explorar catálogo público</span>
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>

                {/* FORMULARIO CENTRADO */}
                <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
                    <div className="w-full max-w-[390px] rounded-2xl border border-borde/80 bg-white p-7 shadow-tarjeta lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
                        <div className="mb-7">
                            <div className="mb-4 hidden items-center gap-2 lg:inline-flex">
                                <div className="grid size-8 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-navegacion/10">
                                    <img
                                        src={logoIncaTour}
                                        alt=""
                                        aria-hidden="true"
                                        className="size-full object-contain"
                                    />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider text-marca-oscura">
                                    IncaTour · Acceso
                                </span>
                            </div>

                            <h1 className="text-2xl font-bold tracking-tight text-navegacion sm:text-[28px]">
                                Iniciar sesión
                            </h1>
                            <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">
                                Ingresá con tu cuenta de cliente, guía o administrador para continuar.
                            </p>
                        </div>

                        <form
                            onSubmit={handleSubmit(enviar)}
                            noValidate
                            className="space-y-4"
                        >
                            {iniciarSesion.isError ? (
                                <Alerta tipo="error">
                                    {iniciarSesion.error.message}
                                </Alerta>
                            ) : null}

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="login-email"
                                    className="block text-xs font-semibold uppercase tracking-wide text-texto"
                                >
                                    Correo electrónico
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-texto-suave">
                                        <IconoCorreo />
                                    </span>
                                    <input
                                        id="login-email"
                                        type="email"
                                        autoComplete="username"
                                        placeholder="nombre@correo.com"
                                        {...register("email")}
                                        className="w-full rounded-xl border border-borde bg-white py-2.5 pl-10 pr-3.5 text-sm text-navegacion placeholder:text-texto-suave/60 outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                                    />
                                </div>
                                {errors.email ? (
                                    <span
                                        role="alert"
                                        className="block text-xs text-peligro"
                                    >
                                        {errors.email.message}
                                    </span>
                                ) : null}
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="login-password"
                                    className="block text-xs font-semibold uppercase tracking-wide text-texto"
                                >
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-texto-suave">
                                        <IconoCandado />
                                    </span>
                                    <input
                                        id="login-password"
                                        type={verContrasenia ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="Tu contraseña"
                                        {...register("contrasenia")}
                                        className="w-full rounded-xl border border-borde bg-white py-2.5 pl-10 pr-11 text-sm text-navegacion placeholder:text-texto-suave/60 outline-none transition focus:border-marca focus:ring-4 focus:ring-marca/15"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setVerContrasenia((v) => !v)}
                                        aria-pressed={verContrasenia}
                                        aria-label={
                                            verContrasenia
                                                ? "Ocultar contraseña"
                                                : "Mostrar contraseña"
                                        }
                                        className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-texto-suave transition hover:text-navegacion"
                                    >
                                        <IconoOjo tachado={verContrasenia} />
                                    </button>
                                </div>
                                {errors.contrasenia ? (
                                    <span
                                        role="alert"
                                        className="block text-xs text-peligro"
                                    >
                                        {errors.contrasenia.message}
                                    </span>
                                ) : null}
                            </div>

                            <button
                                type="submit"
                                disabled={iniciarSesion.isPending}
                                aria-busy={iniciarSesion.isPending}
                                className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navegacion to-marca-oscura px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {iniciarSesion.isPending ? "Ingresando..." : "Ingresar"}
                            </button>
                        </form>

                        {/* REGISTRO PARA NUEVOS CLIENTES */}
                        <div className="mt-7 border-t border-borde/80 pt-6">
                            <p className="text-center text-xs text-texto-suave">
                                ¿Planeás tu viaje y todavía no tenés cuenta?
                            </p>
                            <Link
                                to="/registro"
                                className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-borde bg-fondo/50 px-4 py-2.5 text-sm font-semibold text-navegacion transition hover:border-marca/45 hover:bg-marca-suave/50"
                            >
                                Crear cuenta de cliente
                            </Link>
                        </div>
                    </div>
                </div>

                {/* PIE DISCRETO */}
                <footer className="px-8 pb-6 text-center text-[11px] text-texto-suave/80 lg:text-left">
                    IncaTour · Operador de expediciones en Cusco y Machu Picchu
                </footer>
            </section>
        </main>
    );
}

export default Login;
