import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import {
    esquemaModificarCliente,
    useDarDeBajaCuentaCliente,
    useMisReservas,
    useModificarCuentaCliente,
    usePerfilClienteActual,
    type DatosModificarClienteForm,
} from "../../services/clientePortalService";

function MiCuentaClientePage() {
    const navegar = useNavigate();

    const {
        data: perfil,
        isLoading: cargandoPerfil,
        isError: errorPerfil,
        error: objErrorPerfil,
    } = usePerfilClienteActual();

    const { data: reservasConfirmadas = [] } = useMisReservas("CONFIRMADA");

    const modificarMutacion = useModificarCuentaCliente();
    const darDeBajaMutacion = useDarDeBajaCuentaCliente();

    const [avisoExito, setAvisoExito] = useState<string | null>(null);
    const [avisoDescartado, setAvisoDescartado] = useState<string | null>(null);
    const [dialogoBajaAbierto, setDialogoBajaAbierto] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<DatosModificarClienteForm>({
        resolver: zodResolver(esquemaModificarCliente),
        defaultValues: {
            nombre: "",
            apellido: "",
            email: "",
        },
    });

    useEffect(() => {
        document.title = "Mi cuenta · IncaTour";
    }, []);

    useEffect(() => {
        if (perfil) {
            reset({
                nombre: perfil.usuario.nombre,
                apellido: perfil.usuario.apellido,
                email: perfil.usuario.email,
            });
        }
    }, [perfil, reset]);

    function guardarCambios(valores: DatosModificarClienteForm) {
        if (!perfil) return;
        setAvisoExito(null);
        setAvisoDescartado(null);
        darDeBajaMutacion.reset();

        modificarMutacion.mutate(
            {
                idcliente: perfil.idcliente,
                nombre: valores.nombre,
                apellido: valores.apellido,
                email: valores.email,
            },
            {
                onSuccess: (respuesta) => {
                    setAvisoExito(
                        `${respuesta.mensaje}: tus datos personales fueron actualizados correctamente.`,
                    );
                },
            },
        );
    }

    function cancelarCambios() {
        if (!perfil) return;
        modificarMutacion.reset();
        setAvisoExito(null);
        reset({
            nombre: perfil.usuario.nombre,
            apellido: perfil.usuario.apellido,
            email: perfil.usuario.email,
        });
        setAvisoDescartado("Se restauraron los datos guardados de tu cuenta.");
    }

    function confirmarBajaCuenta() {
        if (!perfil) return;
        setAvisoExito(null);
        setAvisoDescartado(null);

        darDeBajaMutacion.mutate(perfil.idcliente, {
            onSuccess: () => {
                setDialogoBajaAbierto(false);
                navegar("/login", { replace: true });
            },
            onError: () => {
                setDialogoBajaAbierto(false);
            },
        });
    }

    return (
        <section aria-labelledby="account-title" className="space-y-6">
            {/* ENCABEZADO CONSISTENTE CON PORTAL DEL GUÍA / GESTIÓN */}
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde/60 pb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-marca">
                        Portal del cliente · CU-28 y CU-29
                    </p>
                    <h1
                        id="account-title"
                        className="mt-1 text-2xl font-bold text-navegacion md:text-3xl"
                    >
                        Mi cuenta
                    </h1>
                    <p className="text-sm text-texto-suave">
                        Consultá y actualizá tus datos personales o solicitá la
                        baja de tu cuenta de cliente
                    </p>
                </div>
            </header>

            {cargandoPerfil ? (
                <EstadoListado estado="cargando" />
            ) : errorPerfil || !perfil ? (
                <EstadoListado
                    estado="error"
                    mensaje={
                        objErrorPerfil instanceof Error
                            ? objErrorPerfil.message
                            : "No se pudo cargar la información de tu cuenta."
                    }
                />
            ) : (
                <>
                    {/* BANNER RESUMEN DE PERFIL */}
                    <article className="grid grid-cols-1 items-center gap-4 rounded-tarjeta border-y border-r border-l-4 border-borde border-l-[#16d6dc] bg-white p-5 shadow-tarjeta md:grid-cols-[auto_1fr_auto]">
                        <div className="grid size-12 place-items-center rounded-xl bg-[#1b9fc7] text-base font-bold text-white">
                            {`${perfil.usuario.nombre.charAt(0)}${perfil.usuario.apellido.charAt(0)}`.toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-navegacion">
                                {perfil.usuario.nombre} {perfil.usuario.apellido}
                            </h2>
                            <p className="text-xs text-texto-suave">
                                N° de Cliente:{" "}
                                <span className="font-mono font-semibold text-texto">
                                    {perfil.nroCliente}
                                </span>{" "}
                                · {perfil.usuario.email}
                            </p>
                        </div>
                        <div>
                            <span className="inline-flex rounded-full bg-[#e0f4e8] px-3 py-1 text-xs font-bold text-[#216442]">
                                {perfil.estado}
                            </span>
                        </div>
                    </article>

                    {/* ALERTAS DE FEEDBACK */}
                    {avisoExito ? (
                        <Alerta tipo="exito" titulo="Cuenta actualizada">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span>{avisoExito}</span>
                                <button
                                    type="button"
                                    onClick={() => setAvisoExito(null)}
                                    className="text-xs font-semibold underline"
                                >
                                    Cerrar aviso
                                </button>
                            </div>
                        </Alerta>
                    ) : null}

                    {avisoDescartado ? (
                        <Alerta tipo="informacion">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span>{avisoDescartado}</span>
                                <button
                                    type="button"
                                    onClick={() => setAvisoDescartado(null)}
                                    className="text-xs font-semibold underline"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </Alerta>
                    ) : null}

                    {modificarMutacion.isError ? (
                        <Alerta
                            tipo="error"
                            titulo="No se pudieron guardar los cambios"
                        >
                            {modificarMutacion.error.message}
                        </Alerta>
                    ) : null}

                    {/* PANEL 1: DATOS PERSONALES (CU-28: MODIFICAR CUENTA DE CLIENTE) */}
                    <article className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta">
                        <div className="mb-5 border-b border-borde/70 pb-3">
                            <h2 className="text-base font-bold text-navegacion">
                                Datos personales (CU-28)
                            </h2>
                            <p className="mt-1 text-xs text-texto-suave">
                                Editá tu nombre, apellido y correo electrónico
                                desde esta página.
                            </p>
                        </div>

                        <form
                            id="account-form"
                            onSubmit={handleSubmit(guardarCambios)}
                            noValidate
                            className="space-y-5"
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="cuenta-nombre"
                                        className="mb-1.5 block text-xs font-semibold text-texto"
                                    >
                                        Nombre *
                                    </label>
                                    <input
                                        id="cuenta-nombre"
                                        type="text"
                                        autoComplete="given-name"
                                        placeholder="Tu nombre"
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
                                        htmlFor="cuenta-apellido"
                                        className="mb-1.5 block text-xs font-semibold text-texto"
                                    >
                                        Apellido *
                                    </label>
                                    <input
                                        id="cuenta-apellido"
                                        type="text"
                                        autoComplete="family-name"
                                        placeholder="Tu apellido"
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

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="cuenta-email"
                                        className="mb-1.5 block text-xs font-semibold text-texto"
                                    >
                                        Correo electrónico *
                                    </label>
                                    <input
                                        id="cuenta-email"
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

                                <div>
                                    <label
                                        htmlFor="cuenta-nro-cliente"
                                        className="mb-1.5 block text-xs font-semibold text-texto"
                                    >
                                        N° de Cliente (asignado por el sistema)
                                    </label>
                                    <input
                                        id="cuenta-nro-cliente"
                                        type="text"
                                        value={perfil.nroCliente}
                                        disabled
                                        className="w-full cursor-not-allowed rounded-control border border-borde bg-fondo px-3 py-2 font-mono text-sm text-texto-suave"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-end gap-3 border-t border-borde pt-4">
                                <Boton
                                    variante="secundario"
                                    onClick={cancelarCambios}
                                    disabled={
                                        modificarMutacion.isPending || !isDirty
                                    }
                                >
                                    Cancelar cambios
                                </Boton>
                                <Boton
                                    type="submit"
                                    cargando={modificarMutacion.isPending}
                                >
                                    Guardar cambios
                                </Boton>
                            </div>
                        </form>
                    </article>

                    {/* PANEL 2: ZONA DE PELIGRO · BAJA DE CUENTA (CU-29) */}
                    <article className="space-y-4 rounded-tarjeta border border-peligro/40 bg-[#fff7f5] p-6 shadow-tarjeta">
                        <div>
                            <h2 className="text-base font-bold text-[#8f352e]">
                                Zona de peligro · Baja de cuenta (CU-29)
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-[#764c48]">
                                La baja inhabilita tu cuenta de cliente (estado{" "}
                                <strong>INACTIVO</strong>) y cierra tu sesión
                                actual. Para poder dar de baja la cuenta no
                                debés poseer reservas activas en estado{" "}
                                <strong>Confirmada</strong>.
                            </p>
                        </div>

                        {reservasConfirmadas.length > 0 ? (
                            <Alerta
                                tipo="advertencia"
                                titulo={`Tenés ${reservasConfirmadas.length} ${reservasConfirmadas.length === 1 ? "reserva confirmada activa" : "reservas confirmadas activas"}`}
                            >
                                No se permite dar de baja una cuenta mientras
                                existan reservas en estado Confirmada. Podés
                                gestionarlas desde{" "}
                                <Link
                                    to="/mis-reservas"
                                    className="font-bold underline"
                                >
                                    Mis reservas
                                </Link>
                                .
                            </Alerta>
                        ) : null}

                        {darDeBajaMutacion.isError ? (
                            <Alerta
                                tipo="error"
                                titulo="No se pudo dar de baja la cuenta"
                            >
                                {darDeBajaMutacion.error.message}
                            </Alerta>
                        ) : null}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <span className="text-xs text-[#764c48]">
                                Cuenta asociada a{" "}
                                <strong>{perfil.usuario.email}</strong> (
                                {perfil.nroCliente})
                            </span>
                            <Boton
                                variante="peligro"
                                onClick={() => {
                                    darDeBajaMutacion.reset();
                                    setDialogoBajaAbierto(true);
                                }}
                                cargando={darDeBajaMutacion.isPending}
                            >
                                Solicitar baja de cuenta
                            </Boton>
                        </div>
                    </article>
                </>
            )}

            {/* DIÁLOGO DE CONFIRMACIÓN PARA LA BAJA DE CUENTA (CU-29) */}
            <DialogoConfirmacion
                abierto={dialogoBajaAbierto}
                titulo="¿Confirmás la baja de tu cuenta de cliente?"
                descripcion="Al confirmar, tu cuenta pasará a estado INACTIVO y se cerrará tu sesión inmediatamente. Esta acción requiere no tener reservas confirmadas vigentes."
                textoConfirmar="Sí, dar de baja mi cuenta"
                textoCancelar="Cancelar"
                cargando={darDeBajaMutacion.isPending}
                onConfirmar={confirmarBajaCuenta}
                onCancelar={() => setDialogoBajaAbierto(false)}
            />
        </section>
    );
}

export default MiCuentaClientePage;
