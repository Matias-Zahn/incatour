import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioEtapa from "../../components/FormularioEtapa";
import Tabla from "../../components/Tabla";
import {
    detectarDiscontinuidadesEspaciales,
    esquemaSecuenciaEtapas,
    useCircuitos,
    useConfirmarSecuenciaCompleta,
    useEtapas,
    type DatosEtapa,
    type Etapa,
} from "../../services/etapaService";

function reenumerarSecuencia(lista: Etapa[], idcircuito: number): Etapa[] {
    return lista.map((etapa, indice) => ({
        ...etapa,
        id: indice + 1,
        idcircuito,
        numeroOrden: indice + 1,
    }));
}

function EtapasPage() {
    const params = useParams();
    const navegar = useNavigate();
    const {
        data: circuitos = [],
        isPending: cargandoCircuitos,
        isError: errorCircuitos,
        error: detalleErrorCircuitos,
    } = useCircuitos();

    const idParam = Number(params.idCircuito);
    const idCircuitoActivo =
        Number.isInteger(idParam) && idParam > 0
            ? idParam
            : (circuitos[0]?.idcircuito ?? 1);

    const circuitoSeleccionado = circuitos.find(
        (circuito) => circuito.idcircuito === idCircuitoActivo,
    );
    const circuitoNoEncontrado =
        !cargandoCircuitos &&
        !errorCircuitos &&
        circuitos.length > 0 &&
        !circuitoSeleccionado;
    const circuitoInactivo =
        circuitoSeleccionado?.estado === "INACTIVO" || circuitoNoEncontrado;

    const {
        data: etapasServidor = [],
        isPending: cargandoEtapas,
        isError: errorEtapas,
        error: detalleErrorEtapas,
    } = useEtapas(idCircuitoActivo);

    const confirmarSecuencia = useConfirmarSecuenciaCompleta(idCircuitoActivo);

    const [borradoresPorCircuito, setBorradoresPorCircuito] = useState<
        Record<number, Etapa[] | undefined>
    >({});
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [etapaEnEdicion, setEtapaEnEdicion] = useState<Etapa | null>(null);
    const [etapaAEliminar, setEtapaAEliminar] = useState<Etapa | null>(null);
    const [errorValidacion, setErrorValidacion] = useState("");
    const [mensajeExito, setMensajeExito] = useState("");

    const borradorActual = borradoresPorCircuito[idCircuitoActivo];
    const etapas = borradorActual ?? etapasServidor;
    const tieneCambiosPendientes = borradorActual !== undefined;

    const discontinuidades = detectarDiscontinuidadesEspaciales(etapas);
    const mapaDiscontinuidades = new Map(
        discontinuidades.map((item) => [item.numeroOrdenActual, item]),
    );

    function actualizarBorrador(nuevaSecuencia: Etapa[]) {
        setBorradoresPorCircuito((previo) => ({
            ...previo,
            [idCircuitoActivo]: reenumerarSecuencia(nuevaSecuencia, idCircuitoActivo),
        }));
        setErrorValidacion("");
        setMensajeExito("");
    }

    function descartarCambios() {
        setBorradoresPorCircuito((previo) => ({
            ...previo,
            [idCircuitoActivo]: undefined,
        }));
        setFormularioAbierto(false);
        setEtapaEnEdicion(null);
        setErrorValidacion("");
    }

    function cambiarCircuito(nuevoId: number) {
        setFormularioAbierto(false);
        setEtapaEnEdicion(null);
        setErrorValidacion("");
        setMensajeExito("");
        navegar(`/gestion/circuitos/${nuevoId}/etapas`);
    }

    function abrirAlta() {
        if (circuitoInactivo) return;
        setEtapaEnEdicion(null);
        setErrorValidacion("");
        setMensajeExito("");
        setFormularioAbierto(true);
    }

    function abrirEdicion(etapa: Etapa) {
        if (circuitoInactivo) return;
        setEtapaEnEdicion(etapa);
        setErrorValidacion("");
        setMensajeExito("");
        setFormularioAbierto(true);
    }

    function guardarEtapaEnBorrador(datos: DatosEtapa) {
        const etapaNormalizada: Etapa = {
            id: datos.numeroOrden,
            idcircuito: idCircuitoActivo,
            numeroOrden: datos.numeroOrden,
            puntoInicio: datos.puntoInicio.trim(),
            puntoFin: datos.puntoFin.trim(),
            campamentoPrevisto: datos.campamentoPrevisto?.trim() ?? "",
        };

        let siguienteLista: Etapa[];
        if (etapaEnEdicion) {
            const sinEditada = etapas.filter(
                (item) => item.numeroOrden !== etapaEnEdicion.numeroOrden,
            );
            const indiceDestino = Math.max(
                0,
                Math.min(sinEditada.length, datos.numeroOrden - 1),
            );
            siguienteLista = [
                ...sinEditada.slice(0, indiceDestino),
                etapaNormalizada,
                ...sinEditada.slice(indiceDestino),
            ];
        } else {
            const indiceDestino = Math.max(
                0,
                Math.min(etapas.length, datos.numeroOrden - 1),
            );
            siguienteLista = [
                ...etapas.slice(0, indiceDestino),
                etapaNormalizada,
                ...etapas.slice(indiceDestino),
            ];
        }

        actualizarBorrador(siguienteLista);
        setFormularioAbierto(false);
        setEtapaEnEdicion(null);
    }

    function moverEtapa(numeroOrden: number, direccion: -1 | 1) {
        if (circuitoInactivo) return;
        const indice = etapas.findIndex((item) => item.numeroOrden === numeroOrden);
        const destino = indice + direccion;
        if (indice < 0 || destino < 0 || destino >= etapas.length) return;

        const copia = [...etapas];
        const actual = copia[indice]!;
        copia[indice] = copia[destino]!;
        copia[destino] = actual;
        actualizarBorrador(copia);
    }

    function encadenarEtapaConAnterior(numeroOrden: number) {
        const indice = etapas.findIndex((item) => item.numeroOrden === numeroOrden);
        if (indice <= 0) return;
        const anterior = etapas[indice - 1]!;
        const actualizada = etapas.map((etapa, idx) =>
            idx === indice ? { ...etapa, puntoInicio: anterior.puntoFin } : etapa,
        );
        actualizarBorrador(actualizada);
    }

    function encadenarContinuidadEspacial() {
        if (etapas.length <= 1) return;
        const encadenadas = etapas.map((etapa, indice) => {
            if (indice === 0) return etapa;
            const anterior = etapas[indice - 1]!;
            return {
                ...etapa,
                puntoInicio: anterior.puntoFin,
            };
        });
        actualizarBorrador(encadenadas);
    }

    function confirmarQuitarEtapa() {
        if (!etapaAEliminar) return;
        const filtradas = etapas.filter(
            (item) => item.numeroOrden !== etapaAEliminar.numeroOrden,
        );
        actualizarBorrador(filtradas);
        setEtapaAEliminar(null);
    }

    function guardarSecuenciaCompleta() {
        if (circuitoInactivo) return;
        setErrorValidacion("");
        setMensajeExito("");

        const validacion = esquemaSecuenciaEtapas.safeParse({ etapas });
        if (!validacion.success) {
            setErrorValidacion(
                validacion.error.issues[0]?.message ??
                    "La secuencia de etapas tiene errores de validación.",
            );
            return;
        }

        confirmarSecuencia.mutate(validacion.data.etapas, {
            onSuccess: (resultado) => {
                setBorradoresPorCircuito((previo) => ({
                    ...previo,
                    [idCircuitoActivo]: undefined,
                }));
                setMensajeExito(resultado.mensaje);
            },
            onError: (err: Error) => {
                setErrorValidacion(err.message);
            },
        });
    }

    const ultimaEtapa = etapas[etapas.length - 1];
    const puntoInicioSugerido = ultimaEtapa ? ultimaEtapa.puntoFin : "";
    const hayError = errorCircuitos || errorEtapas;
    const mensajeErrorCarga =
        detalleErrorEtapas?.message ?? detalleErrorCircuitos?.message;
    const estado =
        cargandoCircuitos || cargandoEtapas ? "cargando" : hayError ? "error" : "exito";

    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-suave">
                        Gestión de circuitos
                    </p>
                    <h1 className="text-3xl font-bold text-navegacion">
                        Etapas del circuito
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Definí la secuencia correlativa de tramos y campamentos. Al confirmar, se reemplaza la secuencia completa del circuito.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Boton
                        variante="secundario"
                        onClick={abrirAlta}
                        disabled={circuitoInactivo || confirmarSecuencia.isPending}
                        title={
                            circuitoInactivo
                                ? "No se pueden agregar etapas a un circuito inactivo"
                                : undefined
                        }
                    >
                        Agregar etapa
                    </Boton>
                    {tieneCambiosPendientes ? (
                        <Boton
                            variante="fantasma"
                            onClick={descartarCambios}
                            disabled={confirmarSecuencia.isPending}
                        >
                            Descartar cambios
                        </Boton>
                    ) : null}
                    <Boton
                        onClick={guardarSecuenciaCompleta}
                        disabled={
                            circuitoInactivo ||
                            confirmarSecuencia.isPending ||
                            etapas.length === 0
                        }
                        title={
                            circuitoInactivo
                                ? "El circuito no está activo"
                                : undefined
                        }
                    >
                        {confirmarSecuencia.isPending
                            ? "Guardando secuencia..."
                            : "Guardar secuencia completa"}
                    </Boton>
                </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-borde bg-white p-4 shadow-tarjeta">
                <label className="grid gap-1 text-xs font-semibold text-texto-suave sm:min-w-80">
                    Circuito turístico
                    <select
                        value={idCircuitoActivo}
                        onChange={(evento) => cambiarCircuito(Number(evento.target.value))}
                        className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-semibold text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        {circuitoNoEncontrado ? (
                            <option value={idCircuitoActivo} disabled>
                                Circuito #{idCircuitoActivo} (no disponible)
                            </option>
                        ) : null}
                        {circuitos.map((circuito) => (
                            <option key={circuito.idcircuito} value={circuito.idcircuito}>
                                {circuito.nombreCircuito} ({circuito.duracionDias} días ·{" "}
                                {circuito.dificultad}
                                {circuito.estado === "INACTIVO" ? " · INACTIVO" : ""})
                            </option>
                        ))}
                    </select>
                </label>

                {circuitoSeleccionado ? (
                    <div className="flex flex-wrap items-center gap-6 text-sm text-texto-suave">
                        <div>
                            <span className="font-semibold text-texto">Duración:</span>{" "}
                            {circuitoSeleccionado.duracionDias} días
                        </div>
                        <div>
                            <span className="font-semibold text-texto">Dificultad:</span>{" "}
                            {circuitoSeleccionado.dificultad}
                        </div>
                        <div>
                            <span className="font-semibold text-texto">Mínimo guías:</span>{" "}
                            {circuitoSeleccionado.minimoGuias}
                        </div>
                        <div>
                            <span className="font-semibold text-texto">Estado:</span>{" "}
                            <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    circuitoSeleccionado.estado === "ACTIVO"
                                        ? "bg-marca/10 text-marca"
                                        : "bg-borde text-texto-suave"
                                }`}
                            >
                                {circuitoSeleccionado.estado}
                            </span>
                        </div>
                        <div>
                            <span className="font-semibold text-texto">Etapas en secuencia:</span>{" "}
                            <span className="font-semibold text-texto">{etapas.length}</span>{" "}
                            / {circuitoSeleccionado.duracionDias} días
                        </div>
                    </div>
                ) : null}
            </div>

            {circuitoInactivo ? (
                <Alerta
                    tipo="informacion"
                    titulo="Circuito inactivo (modo de solo lectura)"
                >
                    Este circuito se encuentra dado de baja (`INACTIVO`). Podés consultar su secuencia de etapas, pero no se admiten modificaciones.
                </Alerta>
            ) : null}

            {tieneCambiosPendientes ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Cambios pendientes de confirmación"
                >
                    Modificaste la secuencia en borrador. Hacé clic en{" "}
                    <strong>Guardar secuencia completa</strong> para reemplazar todas las etapas del circuito en el servidor.
                </Alerta>
            ) : null}

            {discontinuidades.length > 0 ? (
                <Alerta
                    tipo="advertencia"
                    titulo="Discontinuidad espacial detectada en la secuencia"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                            El fin de la etapa #{discontinuidades[0]!.numeroOrdenAnterior} (
                            <strong>{discontinuidades[0]!.puntoFinAnterior}</strong>) no coincide con el inicio de la etapa #{discontinuidades[0]!.numeroOrdenActual} (
                            <strong>{discontinuidades[0]!.puntoInicioActual}</strong>).
                        </span>
                        {!circuitoInactivo ? (
                            <Boton
                                type="button"
                                variante="secundario"
                                className="px-3 py-1.5 text-xs"
                                onClick={encadenarContinuidadEspacial}
                            >
                                Encadenar tramos automáticamente
                            </Boton>
                        ) : null}
                    </div>
                </Alerta>
            ) : null}

            {errorValidacion ? (
                <Alerta tipo="error" titulo="No se pudo guardar la secuencia de etapas">
                    {errorValidacion}
                </Alerta>
            ) : null}

            {mensajeExito ? (
                <Alerta tipo="exito" titulo="Secuencia actualizada">
                    {mensajeExito}
                </Alerta>
            ) : null}

            {formularioAbierto && !circuitoInactivo ? (
                <FormularioEtapa
                    etapaEnEdicion={etapaEnEdicion}
                    etapasActuales={etapas}
                    numeroOrdenSugerido={etapas.length + 1}
                    puntoInicioSugerido={puntoInicioSugerido}
                    alGuardar={guardarEtapaEnBorrador}
                    alCancelar={() => {
                        setFormularioAbierto(false);
                        setEtapaEnEdicion(null);
                    }}
                    guardando={confirmarSecuencia.isPending}
                />
            ) : null}

            {estado !== "exito" ? (
                <EstadoListado
                    estado={estado}
                    mensaje={estado === "error" ? mensajeErrorCarga : undefined}
                />
            ) : etapas.length === 0 ? (
                <EstadoListado
                    estado="vacio"
                    mensaje="Este circuito todavía no tiene etapas cargadas. Agregá la primera etapa para armar la secuencia."
                />
            ) : (
                <div className="overflow-x-auto">
                    <Tabla
                        filas={etapas}
                        columnas={[
                            {
                                clave: "numeroOrden",
                                titulo: "Orden",
                                renderizar: (etapa) => (
                                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-marca/15 text-xs font-bold text-navegacion">
                                        {etapa.numeroOrden}
                                    </span>
                                ),
                            },
                            {
                                clave: "puntoInicio",
                                titulo: "Punto de inicio",
                                renderizar: (etapa) => {
                                    const discontinuidad = mapaDiscontinuidades.get(
                                        etapa.numeroOrden,
                                    );
                                    return (
                                        <div>
                                            <p
                                                className={`font-medium ${
                                                    discontinuidad
                                                        ? "text-peligro"
                                                        : "text-texto"
                                                }`}
                                            >
                                                {etapa.puntoInicio}
                                            </p>
                                            {discontinuidad ? (
                                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-peligro">
                                                    <span>
                                                        Se esperaba &apos;
                                                        {discontinuidad.puntoFinAnterior}
                                                        &apos; (fin de etapa #
                                                        {discontinuidad.numeroOrdenAnterior})
                                                    </span>
                                                    {!circuitoInactivo ? (
                                                        <button
                                                            type="button"
                                                            className="font-semibold text-marca hover:underline"
                                                            onClick={() =>
                                                                encadenarEtapaConAnterior(
                                                                    etapa.numeroOrden,
                                                                )
                                                            }
                                                        >
                                                            Corregir
                                                        </button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                },
                            },
                            {
                                clave: "puntoFin",
                                titulo: "Punto de fin",
                            },
                            {
                                clave: "campamentoPrevisto",
                                titulo: "Campamento previsto",
                                renderizar: (etapa) =>
                                    etapa.campamentoPrevisto ? (
                                        <span>{etapa.campamentoPrevisto}</span>
                                    ) : (
                                        <span className="text-xs text-texto-suave">
                                            Sin campamento
                                        </span>
                                    ),
                            },
                            {
                                clave: "id",
                                titulo: "Acciones",
                                renderizar: (etapa) => (
                                    <div className="flex flex-wrap gap-2">
                                        <Boton
                                            variante="fantasma"
                                            className="px-2.5 py-1 text-xs"
                                            onClick={() => moverEtapa(etapa.numeroOrden, -1)}
                                            disabled={circuitoInactivo || etapa.numeroOrden === 1}
                                            title="Subir etapa"
                                        >
                                            ↑
                                        </Boton>
                                        <Boton
                                            variante="fantasma"
                                            className="px-2.5 py-1 text-xs"
                                            onClick={() => moverEtapa(etapa.numeroOrden, 1)}
                                            disabled={
                                                circuitoInactivo ||
                                                etapa.numeroOrden === etapas.length
                                            }
                                            title="Bajar etapa"
                                        >
                                            ↓
                                        </Boton>
                                        <Boton
                                            variante="fantasma"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => abrirEdicion(etapa)}
                                            disabled={circuitoInactivo}
                                        >
                                            Editar
                                        </Boton>
                                        <Boton
                                            variante="peligro"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => setEtapaAEliminar(etapa)}
                                            disabled={circuitoInactivo}
                                        >
                                            Quitar
                                        </Boton>
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            )}

            <DialogoConfirmacion
                abierto={etapaAEliminar !== null}
                titulo="Quitar etapa de la secuencia"
                descripcion={
                    etapaAEliminar
                        ? `¿Querés quitar la etapa #${etapaAEliminar.numeroOrden} (${etapaAEliminar.puntoInicio} → ${etapaAEliminar.puntoFin})? Las etapas restantes se renumerarán automáticamente; recordá verificar la continuidad espacial antes de guardar la secuencia.`
                        : ""
                }
                textoConfirmar="Quitar etapa"
                onConfirmar={confirmarQuitarEtapa}
                onCancelar={() => setEtapaAEliminar(null)}
            />
        </section>
    );
}

export default EtapasPage;

