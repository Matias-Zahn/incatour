import { useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import Paginacion from "../../components/Paginacion";
import Tabla from "../../components/Tabla";
import {
    useCuentasGuia,
    useDarDeBajaCuenta,
    type CuentaGuia,
    type EstadoCuentaGuia,
    type FiltrosCuentaGuia,
} from "../../services/cuentaGuiaService";

const ELEMENTOS_POR_PAGINA = 5;

function CuentasGuiaPage() {
    const [filtroEstado, setFiltroEstado] = useState<EstadoCuentaGuia | "">("");
    const [filtroHabilitacion, setFiltroHabilitacion] = useState<"" | "VIGENTE" | "VENCIDA">("");
    const [busqueda, setBusqueda] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaGuia | null>(null);
    const [ultimaCuentaBaja, setUltimaCuentaBaja] = useState<CuentaGuia | null>(null);

    const filtrosConsulta: FiltrosCuentaGuia = {
        ...(filtroEstado ? { estado: filtroEstado } : {}),
        ...(filtroHabilitacion ? { habilitacion: filtroHabilitacion } : {}),
        ...(busqueda.trim() ? { busqueda: busqueda.trim() } : {}),
    };

    const { data: cuentas = [], isPending, isError, error } = useCuentasGuia(filtrosConsulta);
    const darDeBaja = useDarDeBajaCuenta();

    function confirmarBaja() {
        if (!cuentaSeleccionada) return;
        setUltimaCuentaBaja(null);
        darDeBaja.mutate(cuentaSeleccionada.idusuario, {
            onSuccess: (cuentaActualizada) => {
                setUltimaCuentaBaja(cuentaActualizada);
                setCuentaSeleccionada(null);
                setPaginaActual(1);
            },
            onError: () => {
                setCuentaSeleccionada(null);
            },
        });
    }

    function limpiarFiltros() {
        setFiltroEstado("");
        setFiltroHabilitacion("");
        setBusqueda("");
        setPaginaActual(1);
    }

    const totalPaginas = Math.max(
        1,
        Math.ceil(cuentas.length / ELEMENTOS_POR_PAGINA),
    );
    const indiceInicio = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
    const cuentasPaginadas = cuentas.slice(
        indiceInicio,
        indiceInicio + ELEMENTOS_POR_PAGINA,
    );

    const hayFiltrosActivos =
        Boolean(filtroEstado) || Boolean(filtroHabilitacion) || Boolean(busqueda.trim());

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    const sinResultados = estado === "exito" && cuentas.length === 0;

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Link
                        to="/gestion/personal"
                        className="text-sm font-semibold text-marca hover:underline"
                    >
                        ← Volver a personal operativo
                    </Link>
                    <p className="mb-1 mt-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Gestión de cuentas
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">Cuentas de guía</h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Consultá el estado de acceso, vigencia de habilitación y salidas pendientes de cada guía.
                    </p>
                </div>
            </header>

            {ultimaCuentaBaja ? (
                <Alerta tipo="exito" titulo="Cuenta de guía dada de baja exitosamente">
                    Se desactivó el acceso al sistema de{" "}
                    <span className="font-semibold">
                        {ultimaCuentaBaja.nombre} {ultimaCuentaBaja.apellido}
                    </span>{" "}
                    ({ultimaCuentaBaja.email}). Su legajo operativo permanece en estado{" "}
                    <span className="font-semibold">{ultimaCuentaBaja.guia.estadoPersonal}</span> y se conserva su historial de salidas.
                </Alerta>
            ) : null}

            {darDeBaja.isError ? (
                <Alerta tipo="error" titulo="No se pudo dar de baja la cuenta de guía">
                    {darDeBaja.error.message}
                </Alerta>
            ) : null}

            <div className="grid gap-3 rounded-tarjeta border border-borde bg-white p-4 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Buscar por nombre, apellido o email
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(evento) => {
                            setBusqueda(evento.target.value);
                            setPaginaActual(1);
                        }}
                        placeholder="Ej. Carlos o guia@incatour.com..."
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none placeholder:text-texto-suave focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Estado de la cuenta
                    <select
                        value={filtroEstado}
                        onChange={(evento) => {
                            setFiltroEstado(evento.target.value as EstadoCuentaGuia | "");
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todos los estados</option>
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="INACTIVO">INACTIVO</option>
                    </select>
                </label>

                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                    Situación de habilitación
                    <select
                        value={filtroHabilitacion}
                        onChange={(evento) => {
                            setFiltroHabilitacion(
                                evento.target.value as "" | "VIGENTE" | "VENCIDA",
                            );
                            setPaginaActual(1);
                        }}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        <option value="">Todas</option>
                        <option value="VIGENTE">VIGENTE</option>
                        <option value="VENCIDA">VENCIDA</option>
                    </select>
                </label>

                {hayFiltrosActivos ? (
                    <div className="sm:col-span-3 flex justify-end">
                        <Boton
                            variante="fantasma"
                            className="text-xs text-texto-suave"
                            onClick={limpiarFiltros}
                        >
                            Limpiar filtros
                        </Boton>
                    </div>
                ) : null}
            </div>

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? error?.message : undefined}
                />
            ) : sinResultados ? (
                <EstadoListado
                    estado="vacio"
                    mensaje={
                        hayFiltrosActivos
                            ? "No se encontraron cuentas de guía con los filtros seleccionados."
                            : "Todavía no hay cuentas de guía registradas."
                    }
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={cuentasPaginadas}
                        columnas={[
                            {
                                clave: "email",
                                titulo: "Usuario / Email",
                                renderizar: (cuenta) => (
                                    <div>
                                        <p className="font-semibold text-texto">
                                            {cuenta.nombre} {cuenta.apellido}
                                        </p>
                                        <p className="text-xs text-texto-suave">{cuenta.email}</p>
                                    </div>
                                ),
                            },
                            {
                                clave: "guia",
                                titulo: "Legajo operativo",
                                renderizar: (cuenta) => (
                                    <div>
                                        <p className="text-sm text-texto">
                                            Pasaporte: {cuenta.guia.nroPasaporte}
                                        </p>
                                        <p className="text-xs text-texto-suave">
                                            Legajo:{" "}
                                            <span className="font-semibold text-texto">
                                                {cuenta.guia.estadoPersonal}
                                            </span>
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                clave: "habilitacion",
                                titulo: "Habilitación",
                                renderizar: (cuenta) => (
                                    <div>
                                        <p className="font-medium text-texto">
                                            {cuenta.habilitacion.nroHabilitacion ?? "Sin número"} ·{" "}
                                            <span
                                                className={`text-xs font-semibold ${
                                                    cuenta.habilitacion.situacion === "VIGENTE"
                                                        ? "text-marca"
                                                        : cuenta.habilitacion.situacion === "VENCIDA"
                                                          ? "text-peligro"
                                                          : "text-texto-suave"
                                                }`}
                                            >
                                                {cuenta.habilitacion.situacion}
                                            </span>
                                        </p>
                                        {cuenta.habilitacion.fechaHabilitacion ? (
                                            <p className="text-xs text-texto-suave">
                                                Vence{" "}
                                                {cuenta.habilitacion.fechaHabilitacion.slice(0, 10)}
                                            </p>
                                        ) : null}
                                    </div>
                                ),
                            },
                            {
                                clave: "salidasPendientes",
                                titulo: "Salidas pendientes",
                                renderizar: (cuenta) => (
                                    <div>
                                        <span
                                            className={`font-semibold ${
                                                cuenta.salidasPendientes > 0
                                                    ? "text-peligro"
                                                    : "text-texto"
                                            }`}
                                        >
                                            {cuenta.salidasPendientes}
                                        </span>
                                        {cuenta.salidasPendientes > 0 ? (
                                            <p className="text-xs text-texto-suave">
                                                Bloquea la baja
                                            </p>
                                        ) : null}
                                    </div>
                                ),
                            },
                            {
                                clave: "estado",
                                titulo: "Estado cuenta",
                                renderizar: (cuenta) => (
                                    <span
                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                            cuenta.estado === "ACTIVO"
                                                ? "bg-marca/10 text-marca"
                                                : "bg-borde text-texto-suave"
                                        }`}
                                    >
                                        {cuenta.estado}
                                    </span>
                                ),
                            },
                            {
                                clave: "idusuario",
                                titulo: "Acciones",
                                renderizar: (cuenta) => (
                                    <Boton
                                        variante="peligro"
                                        className="px-3 py-1.5 text-xs"
                                        onClick={() => {
                                            darDeBaja.reset();
                                            setCuentaSeleccionada(cuenta);
                                        }}
                                        disabled={!cuenta.puedeDarseDeBaja}
                                        title={
                                            cuenta.estado === "INACTIVO"
                                                ? "La cuenta ya está dada de baja"
                                                : cuenta.salidasPendientes > 0
                                                  ? "Tiene salidas pendientes sin finalizar"
                                                  : undefined
                                        }
                                    >
                                        Dar de baja cuenta
                                    </Boton>
                                ),
                            },
                        ]}
                    />
                </div>
            )}

            {estado === "exito" && cuentas.length > 0 ? (
                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    onCambiarPagina={setPaginaActual}
                />
            ) : null}

            <DialogoConfirmacion
                abierto={cuentaSeleccionada !== null}
                titulo="Confirmar baja de cuenta de guía"
                descripcion={
                    cuentaSeleccionada
                        ? `¿Querés dar de baja la cuenta de acceso de ${cuentaSeleccionada.nombre} ${cuentaSeleccionada.apellido} (${cuentaSeleccionada.email})? El guía ya no podrá iniciar sesión, pero se conservará su legajo operativo e historial de salidas.`
                        : ""
                }
                textoConfirmar={darDeBaja.isPending ? "Procesando..." : "Dar de baja"}
                cargando={darDeBaja.isPending}
                onConfirmar={confirmarBaja}
                onCancelar={() => setCuentaSeleccionada(null)}
            />
        </section>
    );
}

export default CuentasGuiaPage;

