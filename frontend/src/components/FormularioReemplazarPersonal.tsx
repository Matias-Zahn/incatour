import { useId, useState } from "react";
import Alerta from "./Alerta";
import Boton from "./Boton";
import DialogoConfirmacion from "./DialogoConfirmacion";
import {
    estilosEstadoSalida,
    formatearEstadoSalida,
    formatearFechaSalida,
} from "../services/guiaService";
import {
    useReemplazantesDisponibles,
    type DatosPersonalSalida,
    type PayloadConfirmarReemplazo,
    type PersonalSalidaItem,
} from "../services/salidaService";

export type FormularioReemplazarPersonalProps = {
    idsalida: number;
    datosPersonal?: DatosPersonalSalida | null;
    cargandoPersonal?: boolean;
    errorPersonal?: string;
    guardando?: boolean;
    errorReemplazo?: string;
    onRecargarDatos?: () => void;
    onConfirmarReemplazo: (payload: PayloadConfirmarReemplazo) => void;
    onCancelar: () => void;
};

export function FormularioReemplazarPersonal({
    idsalida,
    datosPersonal,
    cargandoPersonal = false,
    errorPersonal,
    guardando = false,
    errorReemplazo,
    onRecargarDatos,
    onConfirmarReemplazo,
    onCancelar,
}: FormularioReemplazarPersonalProps) {
    const idSeccion = useId();

    const [personaOriginalId, setPersonaOriginalId] = useState<number | null>(null);
    const [reemplazanteId, setReemplazanteId] = useState<number | null>(null);
    const [motivo, setMotivo] = useState("");
    const [dialogoConfirmacionAbierto, setDialogoConfirmacionAbierto] = useState(false);

    // Consulta de reemplazantes disponibles para el integrante seleccionado
    const {
        data: reemplazantes,
        isPending: cargandoReemplazantes,
        error: errorReemplazantes,
    } = useReemplazantesDisponibles(idsalida, personaOriginalId);

    const personaOriginal: PersonalSalidaItem | undefined = datosPersonal?.personal.find(
        (p) => p.idpersonal === personaOriginalId,
    );

    const reemplazanteSeleccionado = reemplazantes?.find(
        (r) => r.idpersonal === reemplazanteId,
    );

    const motivoLimpio = motivo.trim();
    const motivoValido = motivoLimpio.length >= 5 && motivoLimpio.length <= 500;
    const formularioValido =
        personaOriginalId !== null &&
        reemplazanteId !== null &&
        personaOriginalId !== reemplazanteId &&
        motivoValido;

    function manejarSeleccionarOriginal(id: number) {
        setPersonaOriginalId(id);
        setReemplazanteId(null);
    }

    function manejarSolicitarConfirmacion() {
        if (!formularioValido || guardando) return;
        setDialogoConfirmacionAbierto(true);
    }

    function manejarEjecutarConfirmacion() {
        if (!formularioValido) return;
        setDialogoConfirmacionAbierto(false);
        onConfirmarReemplazo({
            idoriginal: personaOriginalId!,
            idreemplazante: reemplazanteId!,
            motivo: motivoLimpio,
        });
    }

    // Estado inicial de carga de la información de la salida y personal
    if (cargandoPersonal) {
        return (
            <section
                aria-busy="true"
                className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-4"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-marca border-t-transparent" />
                        <p className="text-sm font-medium text-texto">
                            Consultando personal asignado y logística de la salida...
                        </p>
                    </div>
                    <Boton type="button" variante="secundario" onClick={onCancelar}>
                        Cancelar
                    </Boton>
                </div>
            </section>
        );
    }

    // Error al cargar datos de la salida
    if (!datosPersonal) {
        if (errorPersonal) {
            return (
                <section className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-4">
                    <header className="border-b border-borde pb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Administración
                        </span>
                        <h2 className="text-xl font-bold text-navegacion">
                            Reemplazar personal de la salida
                        </h2>
                    </header>
                    <Alerta tipo="error" titulo="Error al consultar datos de la salida">
                        <p>{errorPersonal}</p>
                    </Alerta>
                    <div className="flex items-center gap-2 pt-2">
                        {onRecargarDatos ? (
                            <Boton type="button" variante="principal" onClick={onRecargarDatos}>
                                Reintentar
                            </Boton>
                        ) : null}
                        <Boton type="button" variante="secundario" onClick={onCancelar}>
                            Volver al listado
                        </Boton>
                    </div>
                </section>
            );
        }
        return null;
    }

    const { salida, personal, servicios, equipamiento } = datosPersonal;

    return (
        <section
            aria-labelledby={`${idSeccion}-titulo`}
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta space-y-6"
        >
            {/* Cabecera del Formulario */}
            <header className="border-b border-borde pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Administración
                        </span>
                        <h2 id={`${idSeccion}-titulo`} className="text-xl font-bold text-navegacion">
                            Reemplazar personal de la salida {salida.nroSalida}
                        </h2>
                    </div>
                    <span className="inline-flex items-center rounded bg-marca-suave px-2.5 py-1 text-xs font-semibold text-navegacion">
                        Perfil: ADMIN
                    </span>
                </div>
                <p className="mt-1 text-sm text-texto-suave">
                    Seleccioná a la persona asignada a reemplazar, elegí un reemplazante disponible del mismo rol
                    e ingresá el motivo para auditar el cambio y gestionar los permisos correspondientes.
                </p>
            </header>

            {/* Error al confirmar reemplazo */}
            {errorReemplazo ? (
                <Alerta tipo="error" titulo="Error al realizar el reemplazo">
                    <p>{errorReemplazo}</p>
                </Alerta>
            ) : null}

            {/* Resumen de la salida y logística */}
            <div className="grid gap-4 rounded-control border border-borde bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                    <span className="font-semibold text-texto-suave uppercase tracking-wider text-[10px]">
                        Salida
                    </span>
                    <p className="font-bold text-texto text-sm">{salida.nroSalida}</p>
                </div>
                <div>
                    <span className="font-semibold text-texto-suave uppercase tracking-wider text-[10px]">
                        Fechas de recorrido
                    </span>
                    <p className="font-medium text-texto">
                        {formatearFechaSalida(salida.fechaInicio)} al {formatearFechaSalida(salida.fechaFin)}
                    </p>
                </div>
                <div>
                    <span className="font-semibold text-texto-suave uppercase tracking-wider text-[10px]">
                        Estado
                    </span>
                    <p className="mt-0.5">
                        <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${estilosEstadoSalida(
                                salida.estado,
                            )}`}
                        >
                            {formatearEstadoSalida(salida.estado)}
                        </span>
                    </p>
                </div>
                <div>
                    <span className="font-semibold text-texto-suave uppercase tracking-wider text-[10px]">
                        Logística asignada
                    </span>
                    <p className="font-medium text-texto">
                        {servicios.length > 0
                            ? servicios.map((s) => s.nombreServicio).join(", ")
                            : "Sin transporte registrado"}
                        {equipamiento.length > 0 &&
                            ` · ${equipamiento.map((e) => `${e.nombreServicio} (${e.cantidad})`).join(", ")}`}
                    </p>
                </div>
            </div>

            {/* Paso 1: Personal asignado actualmente */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-texto">
                        1. Personal asignado actualmente ({personal.length})
                    </h3>
                    <span className="text-xs text-texto-suave">
                        Hacé click en un integrante para iniciar su reemplazo
                    </span>
                </div>

                {personal.length === 0 ? (
                    <Alerta tipo="advertencia" titulo="Sin personal asignado">
                        Esta salida no cuenta con personal asignado para reemplazar.
                    </Alerta>
                ) : (
                    <div className="overflow-x-auto rounded-control border border-borde">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-texto-suave font-semibold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-4 py-2.5">Acción</th>
                                    <th className="px-4 py-2.5">Nombre completo</th>
                                    <th className="px-4 py-2.5">Rol</th>
                                    <th className="px-4 py-2.5">Permiso de la autoridad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-borde">
                                {personal.map((p) => {
                                    const estaSeleccionado = personaOriginalId === p.idpersonal;
                                    return (
                                        <tr
                                            key={p.idpersonal}
                                            onClick={() => manejarSeleccionarOriginal(p.idpersonal)}
                                            className={`cursor-pointer transition-colors ${
                                                estaSeleccionado
                                                    ? "bg-marca-suave/40 font-semibold"
                                                    : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <td className="px-4 py-3">
                                                <input
                                                    type="radio"
                                                    name="personal-a-reemplazar"
                                                    checked={estaSeleccionado}
                                                    onChange={() => manejarSeleccionarOriginal(p.idpersonal)}
                                                    aria-label={`Seleccionar a ${p.nombreCompleto} para reemplazar`}
                                                    className="text-marca focus:ring-marca cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-texto">{p.nombreCompleto}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                                                    {p.rol}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {p.permiso ? (
                                                    <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-800">
                                                        {p.permiso}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-texto-suave">
                                                        Sin permiso emitido
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Paso 2: Selección de Reemplazante Disponible */}
            {personaOriginal && (
                <div className="space-y-3 pt-2 border-t border-borde">
                    <h3 className="text-sm font-bold text-texto">
                        2. Reemplazante disponible para {personaOriginal.nombreCompleto} ({personaOriginal.rol})
                    </h3>

                    {cargandoReemplazantes ? (
                        <div className="flex items-center gap-2 p-4 text-xs text-texto-suave bg-slate-50 rounded-control border border-borde">
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-marca border-t-transparent" />
                            <span>Buscando personal activo disponible del mismo rol y con habilitación vigente...</span>
                        </div>
                    ) : errorReemplazantes ? (
                        <Alerta tipo="error" titulo="Error al consultar reemplazantes">
                            <p>{errorReemplazantes.message}</p>
                        </Alerta>
                    ) : !reemplazantes || reemplazantes.length === 0 ? (
                        <Alerta tipo="advertencia" titulo="No hay reemplazantes disponibles">
                            No se encontró personal disponible con el rol{" "}
                            <strong>{personaOriginal.rol}</strong> que esté libre durante las fechas de la salida y
                            cuente con su habilitación y pasaporte vigentes.
                        </Alerta>
                    ) : (
                        <div className="space-y-2">
                            <label
                                htmlFor="selector-reemplazante"
                                className="block text-xs font-semibold text-texto-suave"
                            >
                                Seleccioná el integrante que ocupará el lugar:
                            </label>
                            <select
                                id="selector-reemplazante"
                                value={reemplazanteId ?? ""}
                                onChange={(e) =>
                                    setReemplazanteId(e.target.value ? Number(e.target.value) : null)
                                }
                                className="w-full max-w-md rounded-control border border-borde bg-white px-3 py-2 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            >
                                <option value="">-- Seleccionar reemplazante disponible --</option>
                                {reemplazantes.map((r) => (
                                    <option key={r.idpersonal} value={r.idpersonal}>
                                        {r.nombreCompleto} ({r.rol})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Paso 3: Motivo del reemplazo */}
            {personaOriginal && (
                <div className="space-y-2 pt-2 border-t border-borde">
                    <label htmlFor="motivo-reemplazo" className="block text-sm font-bold text-texto">
                        3. Motivo del reemplazo <span className="text-rose-600">*</span>
                    </label>
                    <p className="text-xs text-texto-suave">
                        Ingresá la justificación formal del reemplazo (entre 5 y 500 caracteres). Quedará registrada
                        en la auditoría de la salida.
                    </p>
                    <textarea
                        id="motivo-reemplazo"
                        rows={3}
                        value={motivo}
                        maxLength={500}
                        placeholder="Ej: Licencia médica presentada por el guía con certificado..."
                        onChange={(e) => setMotivo(e.target.value)}
                        className="w-full rounded-control border border-borde p-3 text-sm text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                    <div className="flex items-center justify-between text-xs">
                        <span
                            className={
                                motivoLimpio.length > 0 && motivoLimpio.length < 5
                                    ? "text-rose-600 font-semibold"
                                    : "text-texto-suave"
                            }
                        >
                            {motivoLimpio.length < 5
                                ? `Mínimo 5 caracteres (faltan ${5 - motivoLimpio.length})`
                                : "Longitud válida"}
                        </span>
                        <span className="text-texto-suave">{motivoLimpio.length} / 500 caracteres</span>
                    </div>
                </div>
            )}

            {/* Acciones del formulario */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-borde">
                <Boton
                    type="button"
                    variante="secundario"
                    onClick={onCancelar}
                    disabled={guardando}
                >
                    Cancelar
                </Boton>
                <Boton
                    type="button"
                    variante="principal"
                    onClick={manejarSolicitarConfirmacion}
                    disabled={!formularioValido || guardando}
                    cargando={guardando}
                >
                    Confirmar reemplazo
                </Boton>
            </div>

            {/* Diálogo de confirmación antes del envío */}
            {dialogoConfirmacionAbierto && personaOriginal && reemplazanteSeleccionado && (
                <DialogoConfirmacion
                    abierto={dialogoConfirmacionAbierto}
                    titulo="Confirmar reemplazo de personal"
                    descripcion={`¿Confirmás el reemplazo de ${personaOriginal.nombreCompleto} (${personaOriginal.rol}) por ${reemplazanteSeleccionado.nombreCompleto} en la salida ${salida.nroSalida}? Si correspondía, el permiso del titular original se dará de baja y se gestionará el nuevo permiso ante la autoridad gubernamental.`}
                    textoConfirmar="Sí, reemplazar personal"
                    textoCancelar="Revisar datos"
                    cargando={guardando}
                    onConfirmar={manejarEjecutarConfirmacion}
                    onCancelar={() => setDialogoConfirmacionAbierto(false)}
                />
            )}
        </section>
    );
}

export default FormularioReemplazarPersonal;
