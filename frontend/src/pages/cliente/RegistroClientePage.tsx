import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import { useIniciarSesion } from "../../services/autenticacionService";
import {
    esquemaRegistroCliente,
    useRegistrarCliente,
    type ClienteRegistrado,
    type DatosRegistroClienteForm,
} from "../../services/clientePortalService";

function RegistroClientePage() {
    const navegar = useNavigate();
    const registrarMutacion = useRegistrarCliente();
    const iniciarSesionMutacion = useIniciarSesion();

    const [registroExitoso, setRegistroExitoso] = useState<{
        mensaje: string;
        datos: ClienteRegistrado;
        contraseniaTemporal: string;
    } | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<DatosRegistroClienteForm>({
        resolver: zodResolver(esquemaRegistroCliente),
        defaultValues: {
            nombre: "",
            apellido: "",
            email: "",
            contrasenia: "",
            confirmarContrasenia: "",
        },
    });

    useEffect(() => {
        document.title = "Registrarse como cliente · IncaTour";
    }, []);

    function enviarRegistro(valores: DatosRegistroClienteForm) {
        registrarMutacion.mutate(
            {
                nombre: valores.nombre,
                apellido: valores.apellido,
                email: valores.email,
                contrasenia: valores.contrasenia,
            },
            {
                onSuccess: (respuesta) => {
                    setRegistroExitoso({
                        mensaje: respuesta.mensaje,
                        datos: respuesta.data,
                        contraseniaTemporal: valores.contrasenia,
                    });
                    reset();
                },
            },
        );
    }

    function ingresarConCuentaCreada() {
        if (!registroExitoso) return;
        iniciarSesionMutacion.mutate(
            {
                email: registroExitoso.datos.email,
                contrasenia: registroExitoso.contraseniaTemporal,
            },
            {
                onSuccess: () => {
                    navegar("/catalogo", { replace: true });
                },
                onError: () => {
                    navegar("/login", { replace: true });
                },
            },
        );
    }

    return (
        <section
            aria-labelledby="registro-cliente-titulo"
            className="space-y-6"
        >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde/60 pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Portal del cliente · CU-27
                    </p>
                    <h1
                        id="registro-cliente-titulo"
                        className="mt-1 text-2xl font-bold text-navegacion md:text-3xl"
                    >
                        Registrarse como cliente
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Creá tu cuenta personal en IncaTour para reservar
                        paquetes turísticos, consultar itinerarios y calificar
                        tus experiencias
                    </p>
                </div>
            </header>

            {/* Banner informativo con estilo consistente con el portal */}
            <article className="grid grid-cols-1 items-center gap-4 rounded-tarjeta border-y border-r border-l-4 border-borde border-l-[#16d6dc] bg-white p-5 shadow-tarjeta md:grid-cols-[auto_1fr]">
                <div className="grid size-11 place-items-center rounded-xl bg-[#1b9fc7] text-sm font-bold text-white">
                    IT
                </div>
                <div>
                    <h2 className="text-sm font-bold text-navegacion">
                        Alta de cuenta de cliente
                    </h2>
                    <p className="text-xs text-texto-suave">
                        No necesitás iniciar sesión para explorar el catálogo
                        público. Para emitir reservas, gestionar cancelaciones o
                        publicar reseñas se requiere una cuenta activa de
                        cliente.
                    </p>
                </div>
            </article>

            {registroExitoso ? (
                <div className="space-y-5 rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                    <Alerta tipo="exito" titulo={registroExitoso.mensaje}>
                        Tu cuenta de acceso y perfil comercial fueron creados
                        correctamente. Ya podés ingresar al sistema con tu
                        correo electrónico.
                    </Alerta>

                    <div className="grid gap-4 rounded-control border border-borde bg-fondo/60 p-5 sm:grid-cols-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                                N° de Cliente
                            </p>
                            <p className="mt-1 font-mono text-sm font-bold text-navegacion">
                                {registroExitoso.datos.cliente.nroCliente}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                                Titular
                            </p>
                            <p className="mt-1 text-sm font-bold text-navegacion">
                                {registroExitoso.datos.nombre}{" "}
                                {registroExitoso.datos.apellido}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                                Correo registrado
                            </p>
                            <p className="mt-1 text-sm font-semibold text-texto">
                                {registroExitoso.datos.email}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-borde pt-4">
                        <Boton
                            variante="secundario"
                            onClick={() => navegar("/login")}
                        >
                            Ir a Iniciar sesión
                        </Boton>
                        <Boton
                            onClick={ingresarConCuentaCreada}
                            cargando={iniciarSesionMutacion.isPending}
                        >
                            Ingresar ahora al portal →
                        </Boton>
                    </div>
                </div>
            ) : (
                <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                    <div className="mb-5 border-b border-borde/70 pb-3">
                        <h2 className="text-base font-bold text-navegacion">
                            Datos personales y credenciales de acceso
                        </h2>
                        <p className="mt-1 text-xs text-texto-suave">
                            Completá tus datos tal como figuran en tu
                            documentación. El nombre y apellido solo admiten
                            letras y espacios.
                        </p>
                    </div>

                    {registrarMutacion.isError ? (
                        <div className="mb-5">
                            <Alerta
                                tipo="error"
                                titulo="No se pudo completar el registro"
                            >
                                {registrarMutacion.error.message}
                            </Alerta>
                        </div>
                    ) : null}

                    <form
                        onSubmit={handleSubmit(enviarRegistro)}
                        noValidate
                        className="space-y-5"
                    >
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="registro-nombre"
                                    className="mb-1.5 block text-xs font-semibold text-texto"
                                >
                                    Nombre *
                                </label>
                                <input
                                    id="registro-nombre"
                                    type="text"
                                    autoComplete="given-name"
                                    placeholder="Ej.: Juan Ignacio"
                                    {...register("nombre")}
                                    className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.nombre ? (
                                    <p
                                        role="alert"
                                        className="mt-1.5 text-xs text-peligro"
                                    >
                                        {errors.nombre.message}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <label
                                    htmlFor="registro-apellido"
                                    className="mb-1.5 block text-xs font-semibold text-texto"
                                >
                                    Apellido *
                                </label>
                                <input
                                    id="registro-apellido"
                                    type="text"
                                    autoComplete="family-name"
                                    placeholder="Ej.: Pérez"
                                    {...register("apellido")}
                                    className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.apellido ? (
                                    <p
                                        role="alert"
                                        className="mt-1.5 text-xs text-peligro"
                                    >
                                        {errors.apellido.message}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="registro-email"
                                className="mb-1.5 block text-xs font-semibold text-texto"
                            >
                                Correo electrónico *
                            </label>
                            <input
                                id="registro-email"
                                type="email"
                                autoComplete="email"
                                placeholder="tu.correo@ejemplo.com"
                                {...register("email")}
                                className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            />
                            {errors.email ? (
                                <p
                                    role="alert"
                                    className="mt-1.5 text-xs text-peligro"
                                >
                                    {errors.email.message}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="registro-contrasenia"
                                    className="mb-1.5 block text-xs font-semibold text-texto"
                                >
                                    Contraseña (mínimo 8 caracteres) *
                                </label>
                                <input
                                    id="registro-contrasenia"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Mínimo 8 caracteres"
                                    {...register("contrasenia")}
                                    className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.contrasenia ? (
                                    <p
                                        role="alert"
                                        className="mt-1.5 text-xs text-peligro"
                                    >
                                        {errors.contrasenia.message}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <label
                                    htmlFor="registro-confirmar-contrasenia"
                                    className="mb-1.5 block text-xs font-semibold text-texto"
                                >
                                    Confirmar contraseña *
                                </label>
                                <input
                                    id="registro-confirmar-contrasenia"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Repetí tu contraseña"
                                    {...register("confirmarContrasenia")}
                                    className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                {errors.confirmarContrasenia ? (
                                    <p
                                        role="alert"
                                        className="mt-1.5 text-xs text-peligro"
                                    >
                                        {errors.confirmarContrasenia.message}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-borde pt-5">
                            <p className="text-xs text-texto-suave">
                                ¿Ya tenés una cuenta registrada?{" "}
                                <Link
                                    to="/login"
                                    className="font-bold text-marca hover:underline"
                                >
                                    Iniciar sesión
                                </Link>
                            </p>

                            <div className="flex items-center gap-3">
                                <Boton
                                    variante="secundario"
                                    onClick={() => navegar("/catalogo")}
                                    disabled={registrarMutacion.isPending}
                                >
                                    Volver al catálogo
                                </Boton>
                                <Boton
                                    type="submit"
                                    cargando={registrarMutacion.isPending}
                                >
                                    Crear cuenta de cliente
                                </Boton>
                            </div>
                        </div>
                    </form>
                </article>
            )}
        </section>
    );
}

export default RegistroClientePage;
