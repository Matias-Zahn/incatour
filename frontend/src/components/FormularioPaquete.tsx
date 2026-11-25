import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Alerta from "./Alerta";
import AsistentePasos from "./AsistentePasos";
import Boton from "./Boton";
import type { Circuito } from "../services/circuitoService";
import {
    DIAS_CIERRE_VENTA_DEFECTO,
    DIAS_HABILES,
    DIAS_SEMANA,
    FIN_DE_SEMANA,
    TODOS_LOS_DIAS,
    parsearDiasDisponibles,
    serializarDiasDisponibles,
    usePaqueteDetalle,
    useSimularCostoPaquete,
    type CodigoDia,
    type DatosCrearPaquete,
    type DatosModificarPaquete,
    type ItemEquipoPaquete,
    type Paquete,
    type PrecioTemporadaInput,
    type ResultadoSimularCosto,
    type ServicioDisponiblePaquete,
    type TipoGarantiaPaquete,
} from "../services/paqueteService";
import { temporadaVencida, type Temporada } from "../services/temporadaService";
import {
    etiquetaTipoServicio,
    formatearMonto,
    formatearRangoFechasUtc,
} from "../services/formato";

type FormularioPaqueteProps = {
    paqueteEnEdicion?: Paquete | null;
    circuitos: Circuito[];
    temporadas: Temporada[];
    serviciosDisponibles: ServicioDisponiblePaquete[];
    errorCargaServicios?: string;
    alGuardarNuevo: (
        datos: DatosCrearPaquete,
        imagenesArchivos?: File[],
    ) => void;
    alGuardarEdicion: (
        idpaquete: number,
        datos: DatosModificarPaquete,
        imagenesArchivos?: File[],
    ) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

type FilaPrecio = {
    idtemporada: number;
    monto: string;
    moneda: string;
};

const CATEGORIAS_SUGERIDAS = [
    "1 Estrella",
    "2 Estrellas",
    "3 Estrellas",
    "4 Estrellas",
    "5 Estrellas",
];

const HABITACIONES_SUGERIDAS = [
    "Simple",
    "Doble",
    "Triple",
    "Matrimonial",
    "Suite",
];

const LOCALIDADES_BASE = ["Cusco", "Aguas Calientes", "Ollantaytambo", "Urubamba"];

const PASOS_PAQUETE = [
    { titulo: "Datos y garantía", descripcion: "Definí el nombre, circuito, ciudad de salida y garantía hotelera." },
    { titulo: "Servicios y equipo", descripcion: "Elegí el transporte obligatorio, tren opcional y el equipo con su regla por pasajeros." },
    { titulo: "Noches y venta", descripcion: "Configurá las noches de hotel, días habilitados, corte de venta y condiciones." },
    { titulo: "Precios con costo", descripcion: "Revisá el costo por pasajero en vivo, probá un margen y definí las tarifas por temporada." },
];

function esGarantiaEstablecimiento(tipo?: string): boolean {
    return (tipo ?? "").toUpperCase().includes("ESTABLECIMIENTO");
}

function FormularioPaquete({
    paqueteEnEdicion,
    circuitos,
    temporadas,
    serviciosDisponibles,
    errorCargaServicios,
    alGuardarNuevo,
    alGuardarEdicion,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioPaqueteProps) {
    const esEdicion = Boolean(paqueteEnEdicion);
    const { data: detallePaquete } = usePaqueteDetalle(
        paqueteEnEdicion?.idpaquete ?? null,
    );
    const paqueteFuente = detallePaquete ?? paqueteEnEdicion ?? null;

    const [pasoActual, setPasoActual] = useState(0);
    const [errorPaso, setErrorPaso] = useState("");

    // Servicios clasificados por tipo
    const transportesActivos = useMemo(
        () =>
            serviciosDisponibles.filter(
                (s) => s.tipo === "TRANSPORTE" && s.estado === "ACTIVO",
            ),
        [serviciosDisponibles],
    );
    const trenesActivos = useMemo(
        () =>
            serviciosDisponibles.filter(
                (s) => s.tipo === "TREN" && s.estado === "ACTIVO",
            ),
        [serviciosDisponibles],
    );
    const equiposActivos = useMemo(
        () =>
            serviciosDisponibles.filter(
                (s) => s.tipo === "EQUIPAMIENTO" && s.estado === "ACTIVO",
            ),
        [serviciosDisponibles],
    );
    const alojamientosBloqueo = useMemo(
        () =>
            serviciosDisponibles.filter(
                (s) =>
                    s.tipo === "ALOJAMIENTO" &&
                    s.estado === "ACTIVO" &&
                    (s.datos?.modalidadConfirmacion ??
                        s.disponibilidad?.modalidadConfirmacion) ===
                        "BLOQUEO_PLAZAS",
            ),
        [serviciosDisponibles],
    );

    const localidadesSugeridas = useMemo(() => {
        const set = new Set<string>(LOCALIDADES_BASE);
        for (const s of serviciosDisponibles) {
            if (s.localidad?.trim()) set.add(s.localidad.trim());
        }
        return Array.from(set);
    }, [serviciosDisponibles]);

    const localidadInicial =
        paqueteFuente?.localidadGarantizada ??
        paqueteFuente?.garantiasEstablecimiento?.[0]?.servicio?.localidad ??
        "Cusco";

    // Paso 1: Datos y garantía
    const [nombrePaquete, setNombrePaquete] = useState(
        paqueteFuente?.nombrePaquete ?? "",
    );
    const [idcircuito, setIdcircuito] = useState<number>(
        paqueteFuente?.idcircuito ?? circuitos[0]?.idcircuito ?? 0,
    );
    const [localidadGarantizada, setLocalidadGarantizada] = useState(localidadInicial);
    const [tipoGarantia, setTipoGarantia] = useState<TipoGarantiaPaquete>(
        esGarantiaEstablecimiento(paqueteFuente?.tipoGarantia)
            ? "POR_ESTABLECIMIENTO"
            : "POR_CATEGORIA",
    );
    const [categoriaGarantizada, setCategoriaGarantizada] = useState(
        paqueteFuente?.categoriaGarantizada ?? "3 Estrellas",
    );
    const [tipoHabitacionGarantizada, setTipoHabitacionGarantizada] = useState(
        paqueteFuente?.tipoHabitacionGarantizada ?? "Doble",
    );
    const [idservicioGarantizado, setIdservicioGarantizado] = useState<number>(
        paqueteFuente?.garantiasEstablecimiento?.[0]?.idservicio ?? 0,
    );

    // Paso 2: Servicios por tipo (B2)
    const transporteInicial =
        paqueteFuente?.servicios?.find((s) => s.tipo === "TRANSPORTE")?.idservicio ?? 0;
    const trenInicial =
        paqueteFuente?.servicios?.find((s) => s.tipo === "TREN")?.idservicio ?? 0;
    const equipoInicial: ItemEquipoPaquete[] = (paqueteFuente?.servicios ?? [])
        .filter((s) => s.tipo === "EQUIPAMIENTO")
        .map((s) => ({
            idservicio: s.idservicio,
            cantidad: s.cantidad ?? 1,
            cadaPasajeros: s.cadaPasajeros ?? null,
        }));

    const [idtransporte, setIdtransporte] = useState<number>(transporteInicial);
    const [idtren, setIdtren] = useState<number>(trenInicial);
    const [equipo, setEquipo] = useState<ItemEquipoPaquete[]>(equipoInicial);

    // Sincronizar cuando llega el detalle del paquete en edición
    const [sincronizadoDetalleId, setSincronizadoDetalleId] = useState<number | null>(
        paqueteEnEdicion?.servicios ? paqueteEnEdicion.idpaquete : null,
    );
    if (
        detallePaquete &&
        sincronizadoDetalleId !== detallePaquete.idpaquete
    ) {
        setSincronizadoDetalleId(detallePaquete.idpaquete);
        const tr = detallePaquete.servicios?.find((s) => s.tipo === "TRANSPORTE")?.idservicio ?? 0;
        const tren = detallePaquete.servicios?.find((s) => s.tipo === "TREN")?.idservicio ?? 0;
        const eq = (detallePaquete.servicios ?? [])
            .filter((s) => s.tipo === "EQUIPAMIENTO")
            .map((s) => ({
                idservicio: s.idservicio,
                cantidad: s.cantidad ?? 1,
                cadaPasajeros: s.cadaPasajeros ?? null,
            }));
        if (tr) setIdtransporte(tr);
        setIdtren(tren);
        setEquipo(eq);
        const estId = detallePaquete.garantiasEstablecimiento?.[0]?.idservicio ?? 0;
        if (estId) setIdservicioGarantizado(estId);
    }

    // Paso 3: Noches, venta, condiciones e imágenes
    const [nochesPrevias, setNochesPrevias] = useState(
        String(paqueteFuente?.nochesPrevias ?? 1),
    );
    const [nochesPosteriores, setNochesPosteriores] = useState(
        String(paqueteFuente?.nochesPosteriores ?? 1),
    );
    const [diasElegidos, setDiasElegidos] = useState<CodigoDia[]>(
        parsearDiasDisponibles(paqueteFuente?.diasDisponibles),
    );
    const [diasCierreVenta, setDiasCierreVenta] = useState(
        String(paqueteFuente?.diasCierreVenta ?? DIAS_CIERRE_VENTA_DEFECTO),
    );
    const [diasMinimosReintegro, setDiasMinimosReintegro] = useState(
        paqueteFuente?.diasMinimosReintegro != null
            ? String(paqueteFuente.diasMinimosReintegro)
            : "",
    );
    const [condiciones, setCondiciones] = useState(
        paqueteFuente?.condiciones ?? "",
    );
    const [archivosImagenes, setArchivosImagenes] = useState<File[]>([]);
    const inputImagenesRef = useRef<HTMLInputElement>(null);

    // Paso 4: Costo por pasajero (B5) + Matriz de precios
    const temporadasActivas = useMemo(
        () => temporadas.filter((t) => t.estado === "ACTIVO" && !temporadaVencida(t)),
        [temporadas],
    );

    // Las tarifas de temporadas vencidas no se editan: no se muestran, pero se reenvían al guardar para no borrarlas
    const [tarifasPasadas] = useState<PrecioTemporadaInput[]>(() => {
        const vigentes = new Set(temporadasActivas.map((t) => t.idtemporada));
        return (paqueteFuente?.tarifas ?? [])
            .filter((t) => !vigentes.has(t.idtemporada))
            .map((t) => ({ idtemporada: t.idtemporada, monto: Number(t.monto), moneda: "USD" }));
    });

    const [filasPrecios, setFilasPrecios] = useState<FilaPrecio[]>(() => {
        const vigentes = new Set(temporadasActivas.map((t) => t.idtemporada));
        const tarifas = (paqueteFuente?.tarifas ?? []).filter((t) => vigentes.has(t.idtemporada));
        if (tarifas.length > 0) {
            return tarifas.map((t) => ({
                idtemporada: t.idtemporada,
                monto: String(t.monto),
                moneda: t.moneda || "USD",
            }));
        }
        return [
            {
                idtemporada: temporadasActivas[0]?.idtemporada ?? 0,
                monto: "",
                moneda: "USD",
            },
        ];
    });

    const [pasajerosSimulacion, setPasajerosSimulacion] = useState("12");
    const [margenPorcentaje, setMargenPorcentaje] = useState("25");
    // Lo que no sale de los proveedores: no se guarda, solo entra al costo para sugerir la tarifa
    const [personalPorSalida, setPersonalPorSalida] = useState("");
    const [otrosPorPasajero, setOtrosPorPasajero] = useState("");
    const [simulacion, setSimulacion] = useState<ResultadoSimularCosto | null>(null);
    const [errorSimulacion, setErrorSimulacion] = useState("");
    const simularMutation = useSimularCostoPaquete();
    const { mutate: ejecutarSimulacion } = simularMutation;

    // Hoteles filtrados por la ciudad de "Sale desde" (B2)
    const alojamientosCiudad = useMemo(() => {
        const ciudad = localidadGarantizada.trim().toLowerCase();
        if (!ciudad) return alojamientosBloqueo;
        return alojamientosBloqueo.filter(
            (h) => (h.localidad ?? "").trim().toLowerCase() === ciudad,
        );
    }, [alojamientosBloqueo, localidadGarantizada]);

    // Simular costo en vivo al entrar o modificar parámetros en el Paso 4 (B5)
    useEffect(() => {
        if (pasoActual !== 3) return;
        const pax = Number(pasajerosSimulacion);
        if (!Number.isInteger(pax) || pax < 1 || pax > 100) return;
        if (!localidadGarantizada.trim()) return;

        const timer = setTimeout(() => {
            setErrorSimulacion("");
            ejecutarSimulacion(
                {
                    tipoGarantia,
                    ...(tipoGarantia === "POR_ESTABLECIMIENTO" && idservicioGarantizado > 0
                        ? { idservicioGarantizado }
                        : {}),
                    localidadGarantizada: localidadGarantizada.trim(),
                    ...(tipoGarantia === "POR_CATEGORIA"
                        ? { categoriaGarantizada, tipoHabitacionGarantizada }
                        : {}),
                    nochesPrevias: Math.max(0, Number(nochesPrevias) || 0),
                    nochesPosteriores: Math.max(0, Number(nochesPosteriores) || 0),
                    ...(idtransporte > 0 ? { idtransporte } : {}),
                    ...(idtren > 0 ? { idtren } : {}),
                    equipo,
                    pasajeros: pax,
                },
                {
                    onSuccess: (res) => setSimulacion(res),
                    onError: (err) => {
                        setSimulacion(null);
                        setErrorSimulacion(err.message);
                    },
                },
            );
        }, 200);

        return () => clearTimeout(timer);
    }, [
        pasoActual,
        pasajerosSimulacion,
        tipoGarantia,
        idservicioGarantizado,
        localidadGarantizada,
        categoriaGarantizada,
        tipoHabitacionGarantizada,
        nochesPrevias,
        nochesPosteriores,
        idtransporte,
        idtren,
        equipo,
        ejecutarSimulacion,
    ]);

    const paxBase = Number(pasajerosSimulacion) || 1;
    const personalPorPasajero =
        Math.round((Math.max(0, Number(personalPorSalida) || 0) / paxBase) * 100) / 100;
    const otrosPax = Math.max(0, Number(otrosPorPasajero) || 0);
    const costoEstimado =
        simulacion != null
            ? Math.round((simulacion.costoPorPasajero + personalPorPasajero + otrosPax) * 100) / 100
            : null;
    const margenNum = Number(margenPorcentaje);
    const tarifaSugerida =
        costoEstimado !== null && Number.isFinite(margenNum) && margenNum >= 0
            ? Math.round(costoEstimado * (1 + margenNum / 100) * 100) / 100
            : null;

    function alternarDia(codigo: CodigoDia) {
        setDiasElegidos((prev) =>
            prev.includes(codigo) ? prev.filter((d) => d !== codigo) : [...prev, codigo],
        );
    }

    function alternarEquipo(idservicio: number) {
        setEquipo((prev) => {
            if (prev.some((e) => e.idservicio === idservicio)) {
                return prev.filter((e) => e.idservicio !== idservicio);
            }
            return [...prev, { idservicio, cantidad: 1, cadaPasajeros: 1 }];
        });
    }

    function actualizarReglaEquipo(
        idservicio: number,
        campo: "cantidad" | "cadaPasajeros",
        valor: number | null,
    ) {
        setEquipo((prev) =>
            prev.map((item) =>
                item.idservicio === idservicio ? { ...item, [campo]: valor } : item,
            ),
        );
    }

    function agregarFilaPrecio() {
        const usadas = new Set(filasPrecios.map((f) => f.idtemporada));
        const libre = temporadasActivas.find((t) => !usadas.has(t.idtemporada));
        setFilasPrecios((prev) => [
            ...prev,
            {
                idtemporada: libre?.idtemporada ?? 0,
                monto: tarifaSugerida != null ? String(tarifaSugerida) : "",
                moneda: "USD",
            },
        ]);
    }

    function actualizarFilaPrecio(indice: number, cambios: Partial<FilaPrecio>) {
        setFilasPrecios((prev) =>
            prev.map((f, i) => (i === indice ? { ...f, ...cambios } : f)),
        );
    }

    function quitarFilaPrecio(indice: number) {
        setFilasPrecios((prev) => prev.filter((_, i) => i !== indice));
    }

    function aplicarTarifaSugeridaATodas() {
        if (tarifaSugerida == null) return;
        setFilasPrecios((prev) =>
            prev.map((f) => ({ ...f, monto: String(tarifaSugerida) })),
        );
    }

    // Validación por paso (B7: cada paso se valida antes de avanzar)
    function validarPaso(paso: number): string | null {
        if (paso === 0) {
            if (!nombrePaquete.trim()) return "Ingresá el nombre del paquete.";
            if (!idcircuito) return "Seleccioná un circuito activo.";
            if (!localidadGarantizada.trim()) {
                return "Indicá desde qué ciudad sale el paquete (Sale desde).";
            }
            if (tipoGarantia === "POR_ESTABLECIMIENTO") {
                if (!idservicioGarantizado) {
                    return "Elegí un hotel garantizado en la ciudad de salida.";
                }
                const hotel = alojamientosCiudad.find(
                    (h) => h.idservicio === idservicioGarantizado,
                );
                if (!hotel) {
                    return `El hotel elegido no pertenece a ${localidadGarantizada.trim()} o no confirma por bloqueo de plazas.`;
                }
            } else {
                if (!categoriaGarantizada.trim() || !tipoHabitacionGarantizada.trim()) {
                    return "Completá la categoría y el tipo de habitación garantizados.";
                }
            }
            return null;
        }

        if (paso === 1) {
            if (!idtransporte) {
                return "Elegí un servicio de transporte (es obligatorio para todo paquete).";
            }
            for (const item of equipo) {
                if (
                    !Number.isInteger(item.cantidad) ||
                    item.cantidad < 1 ||
                    item.cantidad > 100 ||
                    (item.cadaPasajeros !== null &&
                        (!Number.isInteger(item.cadaPasajeros) ||
                            item.cadaPasajeros < 1 ||
                            item.cadaPasajeros > 100))
                ) {
                    return "Cada equipo seleccionado debe tener cantidad y cadaPasajeros enteros entre 1 y 100.";
                }
            }
            return null;
        }

        if (paso === 2) {
            const prev = Number(nochesPrevias);
            const post = Number(nochesPosteriores);
            const cierre = Number(diasCierreVenta);
            if (!Number.isInteger(prev) || prev < 0 || prev > 30) {
                return "Las noches previas deben ser un entero entre 0 y 30.";
            }
            if (!Number.isInteger(post) || post < 0 || post > 30) {
                return "Las noches posteriores deben ser un entero entre 0 y 30.";
            }
            if (!Number.isInteger(cierre) || cierre < 0 || cierre > 30) {
                return "Los días de cierre de venta deben ser un entero entre 0 y 30.";
            }
            if (diasElegidos.length === 0) {
                return "Elegí al menos un día habilitado para las salidas.";
            }
            if (diasMinimosReintegro.trim() !== "") {
                const reintegro = Number(diasMinimosReintegro);
                if (!Number.isInteger(reintegro) || reintegro < 0 || reintegro > 365) {
                    return "El plazo mínimo de reintegro debe ser un entero entre 0 y 365 días.";
                }
            }
            return null;
        }

        if (paso === 3) {
            if (filasPrecios.length === 0) {
                return "Agregá al menos una tarifa por temporada.";
            }
            const vistas = new Set<number>();
            for (const fila of filasPrecios) {
                if (!fila.idtemporada) {
                    return "Seleccioná una temporada en todas las filas de precios.";
                }
                if (vistas.has(fila.idtemporada)) {
                    return "No podés repetir la misma temporada en la matriz de precios.";
                }
                vistas.add(fila.idtemporada);
                const monto = Number(fila.monto);
                if (!Number.isFinite(monto) || monto <= 0 || monto > 10_000_000) {
                    return "Cada tarifa debe tener un monto mayor a 0 y menor o igual a 10.000.000.";
                }
            }
            return null;
        }

        return null;
    }

    function avanzarPaso() {
        const err = validarPaso(pasoActual);
        if (err) {
            setErrorPaso(err);
            return;
        }
        setErrorPaso("");
        setPasoActual((p) => Math.min(PASOS_PAQUETE.length - 1, p + 1));
    }

    function retrocederPaso() {
        setErrorPaso("");
        setPasoActual((p) => Math.max(0, p - 1));
    }

    function enviarFormulario(evento: React.FormEvent) {
        evento.preventDefault();
        for (let i = 0; i < PASOS_PAQUETE.length; i++) {
            const err = validarPaso(i);
            if (err) {
                setPasoActual(i);
                setErrorPaso(err);
                return;
            }
        }
        setErrorPaso("");

        const matrizPrecios: PrecioTemporadaInput[] = [
            ...tarifasPasadas,
            ...filasPrecios.map((f) => ({
                idtemporada: f.idtemporada,
                monto: Number(f.monto),
                moneda: "USD",
            })),
        ];

        const payloadComun = {
            idcircuito,
            nombrePaquete: nombrePaquete.trim(),
            condiciones: condiciones.trim() || undefined,
            tipoGarantia,
            localidadGarantizada: localidadGarantizada.trim(),
            ...(tipoGarantia === "POR_ESTABLECIMIENTO"
                ? { idservicioGarantizado }
                : {
                      categoriaGarantizada: categoriaGarantizada.trim(),
                      tipoHabitacionGarantizada: tipoHabitacionGarantizada.trim(),
                  }),
            nochesPrevias: Number(nochesPrevias),
            nochesPosteriores: Number(nochesPosteriores),
            diasDisponibles: serializarDiasDisponibles(diasElegidos),
            diasCierreVenta: Number(diasCierreVenta),
            diasMinimosReintegro:
                diasMinimosReintegro.trim() === ""
                    ? null
                    : Number(diasMinimosReintegro),
            idtransporte,
            idtren: idtren > 0 ? idtren : null,
            equipo,
            matrizPrecios,
        };

        if (esEdicion && paqueteEnEdicion) {
            alGuardarEdicion(
                paqueteEnEdicion.idpaquete,
                payloadComun,
                archivosImagenes.length > 0 ? archivosImagenes : undefined,
            );
        } else {
            alGuardarNuevo(
                payloadComun,
                archivosImagenes.length > 0 ? archivosImagenes : undefined,
            );
        }
    }

    return (
        <form onSubmit={enviarFormulario}>
            <AsistentePasos
                titulo={
                    esEdicion
                        ? `Editar paquete ${paqueteEnEdicion?.nroPaquete ?? ""}`
                        : "Nuevo paquete turístico"
                }
                subtitulo="Completá los 4 pasos para publicar o actualizar el paquete."
                pasos={PASOS_PAQUETE}
                pasoActual={pasoActual}
                alCambiarPaso={(nuevo) => {
                    setErrorPaso("");
                    setPasoActual(nuevo);
                }}
                alSiguiente={avanzarPaso}
                alAtras={retrocederPaso}
                alCancelar={alCancelar}
                textoGuardar={esEdicion ? "Guardar cambios" : "Crear paquete"}
                guardando={guardando}
                errorPaso={errorPaso}
                errorServidor={errorServidor}
            >
                {/* ==================== PASO 1: DATOS Y GARANTÍA ==================== */}
                {pasoActual === 0 ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                Nombre del paquete *
                                <input
                                    type="text"
                                    value={nombrePaquete}
                                    onChange={(e) => setNombrePaquete(e.target.value)}
                                    placeholder="Ej. Camino Inca Clásico 4 días"
                                    className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                            </label>

                            <label className="grid gap-1.5 text-sm font-semibold text-texto">
                                Circuito *
                                <select
                                    value={idcircuito}
                                    onChange={(e) => setIdcircuito(Number(e.target.value))}
                                    className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                >
                                    <option value={0}>Elegí un circuito...</option>
                                    {circuitos.map((c) => (
                                        <option key={c.idcircuito} value={c.idcircuito}>
                                            {c.nombreCircuito} ({c.duracionDias} días · {c.dificultad})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="grid gap-1.5 text-sm font-semibold text-texto">
                            Sale desde (ciudad de origen) *
                            <input
                                type="text"
                                list="localidades-salida-paquete"
                                value={localidadGarantizada}
                                onChange={(e) => {
                                    setLocalidadGarantizada(e.target.value);
                                    setIdservicioGarantizado(0);
                                }}
                                placeholder="Ej. Cusco"
                                className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            />
                            <datalist id="localidades-salida-paquete">
                                {localidadesSugeridas.map((loc) => (
                                    <option key={loc} value={loc} />
                                ))}
                            </datalist>
                            <span className="text-xs font-normal text-texto-suave">
                                Se muestra en el catálogo y filtra los hoteles disponibles para la garantía.
                            </span>
                        </label>

                        <div className="space-y-3 rounded-control border border-borde bg-fondo/50 p-4">
                            <p className="text-sm font-semibold text-navegacion">
                                Garantía de alojamiento
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {(
                                    [
                                        ["POR_CATEGORIA", "Por categoría y habitación"],
                                        ["POR_ESTABLECIMIENTO", "Por establecimiento (hotel fijo)"],
                                    ] as const
                                ).map(([valor, etiqueta]) => (
                                    <button
                                        key={valor}
                                        type="button"
                                        onClick={() => setTipoGarantia(valor)}
                                        className={`rounded-control border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                            tipoGarantia === valor
                                                ? "border-marca bg-marca-suave text-marca-oscura"
                                                : "border-borde bg-white text-texto hover:border-marca/40"
                                        }`}
                                    >
                                        {etiqueta}
                                    </button>
                                ))}
                            </div>

                            {tipoGarantia === "POR_CATEGORIA" ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Categoría *
                                        <select
                                            value={categoriaGarantizada}
                                            onChange={(e) => setCategoriaGarantizada(e.target.value)}
                                            className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        >
                                            {CATEGORIAS_SUGERIDAS.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Tipo de habitación *
                                        <select
                                            value={tipoHabitacionGarantizada}
                                            onChange={(e) =>
                                                setTipoHabitacionGarantizada(e.target.value)
                                            }
                                            className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                        >
                                            {HABITACIONES_SUGERIDAS.map((hab) => (
                                                <option key={hab} value={hab}>
                                                    {hab}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {errorCargaServicios ? (
                                        <Alerta tipo="error">{errorCargaServicios}</Alerta>
                                    ) : alojamientosCiudad.length === 0 ? (
                                        <p className="text-xs text-texto-suave">
                                            No hay hoteles activos con bloqueo de plazas en{" "}
                                            <strong>{localidadGarantizada || "esa ciudad"}</strong>.{" "}
                                            <Link
                                                to="/gestion/proveedores"
                                                className="font-semibold text-marca hover:underline"
                                            >
                                                Cargar en Proveedores
                                            </Link>
                                        </p>
                                    ) : (
                                        <label className="grid gap-1 text-xs font-semibold text-texto">
                                            Hotel garantizado en {localidadGarantizada} *
                                            <select
                                                value={idservicioGarantizado}
                                                onChange={(e) =>
                                                    setIdservicioGarantizado(Number(e.target.value))
                                                }
                                                className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                            >
                                                <option value={0}>Elegí un hotel...</option>
                                                {alojamientosCiudad.map((h) => (
                                                    <option key={h.idservicio} value={h.idservicio}>
                                                        {h.nombreServicio} · {h.datos?.categoria ?? "-"}{" "}
                                                        · {h.datos?.tipoHabitacion ?? "-"} (
                                                        {formatearMonto(h.costoBase)}/noche)
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* ==================== PASO 2: SERVICIOS POR TIPO Y EQUIPO ==================== */}
                {pasoActual === 1 ? (
                    <div className="space-y-5">
                        {errorCargaServicios ? (
                            <Alerta tipo="error">{errorCargaServicios}</Alerta>
                        ) : null}

                        {/* Transporte (uno, obligatorio) */}
                        <div className="space-y-2 rounded-control border border-borde bg-fondo/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-navegacion">
                                    1. Transporte *
                                </h3>
                                <span className="text-xs text-texto-suave">
                                    Obligatorio · Se reserva al crear cada salida
                                </span>
                            </div>
                            <select
                                aria-label="Transporte del paquete"
                                value={idtransporte}
                                onChange={(e) => setIdtransporte(Number(e.target.value))}
                                className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            >
                                <option value={0}>Elegí un transporte...</option>
                                {transportesActivos.map((t) => (
                                    <option key={t.idservicio} value={t.idservicio}>
                                        {t.nombreServicio} · {t.datos?.capacidadVehiculo ?? "?"} asientos ·{" "}
                                        {formatearMonto(t.costoBase)} por salida
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Tren (uno, opcional) */}
                        <div className="space-y-2 rounded-control border border-borde bg-fondo/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-navegacion">
                                    2. Tren (opcional)
                                </h3>
                                <span className="text-xs text-texto-suave">
                                    Sus horarios se muestran en el catálogo y en la ficha del guía
                                </span>
                            </div>
                            <select
                                aria-label="Tren del paquete"
                                value={idtren}
                                onChange={(e) => setIdtren(Number(e.target.value))}
                                className="w-full rounded-control border border-borde bg-white px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            >
                                <option value={0}>Sin tren incluido</option>
                                {trenesActivos.map((tr) => (
                                    <option key={tr.idservicio} value={tr.idservicio}>
                                        {tr.nombreServicio} ({tr.datos?.horarioSalida ?? "--:--"}–
                                        {tr.datos?.horarioLlegada ?? "--:--"} ·{" "}
                                        {tr.datos?.diasOperacion ?? "Todos los días"}) ·{" "}
                                        {formatearMonto(tr.costoBase)}/pasajero
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Equipo (varios, con regla cantidad / cadaPasajeros) */}
                        <div className="space-y-3 rounded-control border border-borde bg-fondo/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-navegacion">
                                    3. Equipamiento y regla por pasajeros
                                </h3>
                                <span className="text-xs text-texto-suave">
                                    Se descuenta en cada compra según los pasajeros vendidos
                                </span>
                            </div>

                            {equiposActivos.length === 0 ? (
                                <p className="text-xs text-texto-suave">
                                    No hay servicios de equipamiento activos cargados.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {equiposActivos.map((eq) => {
                                        const regla = equipo.find(
                                            (item) => item.idservicio === eq.idservicio,
                                        );
                                        const seleccionado = Boolean(regla);
                                        return (
                                            <div
                                                key={eq.idservicio}
                                                className={`rounded-control border p-3 transition-colors ${
                                                    seleccionado
                                                        ? "border-marca bg-white"
                                                        : "border-borde bg-white/70"
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-texto">
                                                        <input
                                                            type="checkbox"
                                                            checked={seleccionado}
                                                            onChange={() =>
                                                                alternarEquipo(eq.idservicio)
                                                            }
                                                            className="size-4 accent-marca"
                                                        />
                                                        <span>{eq.nombreServicio}</span>
                                                        <span className="text-xs font-normal text-texto-suave">
                                                            ({eq.datos?.tipoEquipamiento ?? "Equipo"} ·{" "}
                                                            {formatearMonto(eq.costoBase)}/u)
                                                        </span>
                                                    </label>

                                                    {regla ? (
                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                            <label className="flex items-center gap-1.5 font-semibold text-texto">
                                                                Cantidad
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={100}
                                                                    value={regla.cantidad}
                                                                    onChange={(e) =>
                                                                        actualizarReglaEquipo(
                                                                            eq.idservicio,
                                                                            "cantidad",
                                                                            Number(e.target.value),
                                                                        )
                                                                    }
                                                                    className="w-16 rounded-control border border-borde px-2 py-1 text-center font-normal"
                                                                />
                                                            </label>
                                                            <select
                                                                aria-label={`Regla de ${eq.nombreServicio}`}
                                                                value={regla.cadaPasajeros === null ? "salida" : "pasajeros"}
                                                                onChange={(e) =>
                                                                    actualizarReglaEquipo(
                                                                        eq.idservicio,
                                                                        "cadaPasajeros",
                                                                        e.target.value === "salida" ? null : 1,
                                                                    )
                                                                }
                                                                className="rounded-control border border-borde bg-white px-2 py-1 font-normal"
                                                            >
                                                                <option value="pasajeros">cada N pasajeros</option>
                                                                <option value="salida">por salida (fija)</option>
                                                            </select>
                                                            {regla.cadaPasajeros !== null ? (
                                                                <label className="flex items-center gap-1.5 font-semibold text-texto">
                                                                    cada
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        max={100}
                                                                        value={regla.cadaPasajeros}
                                                                        onChange={(e) =>
                                                                            actualizarReglaEquipo(
                                                                                eq.idservicio,
                                                                                "cadaPasajeros",
                                                                                Number(e.target.value),
                                                                            )
                                                                        }
                                                                        className="w-16 rounded-control border border-borde px-2 py-1 text-center font-normal"
                                                                    />
                                                                    pasajeros
                                                                </label>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* ==================== PASO 3: NOCHES, VENTA Y CONDICIONES ==================== */}
                {pasoActual === 2 ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                Noches previas
                                <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={nochesPrevias}
                                    onChange={(e) => setNochesPrevias(e.target.value)}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                            </label>
                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                Noches posteriores
                                <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={nochesPosteriores}
                                    onChange={(e) => setNochesPosteriores(e.target.value)}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                            </label>
                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                Cierre de venta (días antes)
                                <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={diasCierreVenta}
                                    onChange={(e) => setDiasCierreVenta(e.target.value)}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                                <span className="text-[11px] font-normal text-texto-suave">
                                    Por defecto {DIAS_CIERRE_VENTA_DEFECTO} días (5 si el hotel es a solicitud)
                                </span>
                            </label>
                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                Plazo reintegro 100% (días)
                                <input
                                    type="number"
                                    min={0}
                                    max={365}
                                    placeholder="Sin plazo"
                                    value={diasMinimosReintegro}
                                    onChange={(e) => setDiasMinimosReintegro(e.target.value)}
                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                                />
                            </label>
                        </div>

                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-texto">
                                    Días habilitados de salida *
                                </span>
                                <div className="flex flex-wrap gap-1.5 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setDiasElegidos([...TODOS_LOS_DIAS])}
                                        className="rounded border border-borde px-2 py-0.5 text-texto-suave hover:border-marca hover:text-marca"
                                    >
                                        Todos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDiasElegidos([...DIAS_HABILES])}
                                        className="rounded border border-borde px-2 py-0.5 text-texto-suave hover:border-marca hover:text-marca"
                                    >
                                        Lun a Vie
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDiasElegidos([...FIN_DE_SEMANA])}
                                        className="rounded border border-borde px-2 py-0.5 text-texto-suave hover:border-marca hover:text-marca"
                                    >
                                        Finde
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1.5">
                                {DIAS_SEMANA.map((dia) => {
                                    const activo = diasElegidos.includes(dia.codigo);
                                    return (
                                        <button
                                            key={dia.codigo}
                                            type="button"
                                            title={dia.nombre}
                                            aria-pressed={activo}
                                            onClick={() => alternarDia(dia.codigo)}
                                            className={`rounded-control border py-2 text-center text-xs font-bold transition-colors ${
                                                activo
                                                    ? "border-marca bg-marca text-white"
                                                    : "border-borde bg-white text-texto-suave hover:border-marca/40"
                                            }`}
                                        >
                                            {dia.corto}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <label className="grid gap-1.5 text-sm font-semibold text-texto">
                            Condiciones comerciales
                            <textarea
                                rows={3}
                                value={condiciones}
                                onChange={(e) => setCondiciones(e.target.value)}
                                placeholder="Políticas de cancelación, inclusiones, recomendaciones..."
                                className="rounded-control border border-borde bg-white px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            />
                        </label>

                        <div className="rounded-control border border-dashed border-borde bg-fondo/40 p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-texto">
                                    Fotos del paquete (opcional, hasta 5)
                                </span>
                                <Boton
                                    type="button"
                                    variante="secundario"
                                    className="px-3 py-1.5 text-xs"
                                    onClick={() => inputImagenesRef.current?.click()}
                                >
                                    Elegir imágenes
                                </Boton>
                            </div>
                            <input
                                ref={inputImagenesRef}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files ?? []).slice(0, 5);
                                    setArchivosImagenes(files);
                                }}
                            />
                            {archivosImagenes.length > 0 ? (
                                <p className="mt-2 text-texto-suave">
                                    Seleccionadas ({archivosImagenes.length}):{" "}
                                    {archivosImagenes.map((f) => f.name).join(", ")}
                                </p>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* ==================== PASO 4: PRECIOS CON COSTO EN VIVO (B5) ==================== */}
                {pasoActual === 3 ? (
                    <div className="space-y-5">
                        {/* Simulador de costo por pasajero */}
                        <div className="space-y-3 rounded-control border border-marca/30 bg-marca-suave/30 p-4">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-navegacion">
                                        Costo por pasajero
                                    </h3>
                                    <p className="text-xs text-texto-suave">
                                        Servicios elegidos más personal, permisos y otros gastos que cargues abajo.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-end gap-3">
                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Pasajeros base (transporte)
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={pasajerosSimulacion}
                                            onChange={(e) =>
                                                setPasajerosSimulacion(e.target.value)
                                            }
                                            className="w-24 rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal"
                                        />
                                    </label>
                                    <label className="grid gap-1 text-xs font-semibold text-texto">
                                        Margen (%)
                                        <input
                                            type="number"
                                            min={0}
                                            max={500}
                                            value={margenPorcentaje}
                                            onChange={(e) => setMargenPorcentaje(e.target.value)}
                                            className="w-24 rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-end gap-3">
                                <label className="grid gap-1 text-xs font-semibold text-texto">
                                    Personal por salida (USD)
                                    <input
                                        type="number"
                                        min={0}
                                        value={personalPorSalida}
                                        onChange={(e) => setPersonalPorSalida(e.target.value)}
                                        placeholder="Guías, cocineros, porteadores"
                                        className="w-56 rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal"
                                    />
                                </label>
                                <label className="grid gap-1 text-xs font-semibold text-texto">
                                    Permisos y otros por pasajero (USD)
                                    <input
                                        type="number"
                                        min={0}
                                        value={otrosPorPasajero}
                                        onChange={(e) => setOtrosPorPasajero(e.target.value)}
                                        placeholder="Entradas, comidas, comisiones"
                                        className="w-56 rounded-control border border-borde bg-white px-2.5 py-1.5 text-sm font-normal"
                                    />
                                </label>
                            </div>

                            {errorSimulacion ? (
                                <Alerta tipo="advertencia">{errorSimulacion}</Alerta>
                            ) : null}

                            {simulacion?.avisos.map((aviso) => (
                                <Alerta key={aviso} tipo="advertencia">
                                    {aviso}
                                </Alerta>
                            ))}

                            {simulacion ? (
                                <div className="space-y-2 rounded-control border border-borde bg-white p-3">
                                    {simulacion.desglose.length > 0 ? (
                                        <ul className="divide-y divide-borde text-xs">
                                            {simulacion.desglose.map((item, idx) => (
                                                <li
                                                    key={`${item.tipo}-${item.idservicio ?? idx}`}
                                                    className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                                                >
                                                    <div>
                                                        <span className="font-semibold text-texto">
                                                            {etiquetaTipoServicio(item.tipo)}:
                                                        </span>{" "}
                                                        <span>{item.nombreServicio}</span>{" "}
                                                        <span className="text-texto-suave">
                                                            ({item.calculo})
                                                        </span>
                                                    </div>
                                                    <span className="font-semibold text-navegacion">
                                                        {formatearMonto(item.porPasajero)}
                                                    </span>
                                                </li>
                                            ))}
                                            {personalPorPasajero > 0 ? (
                                                <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                                                    <div>
                                                        <span className="font-semibold text-texto">Personal:</span>{" "}
                                                        <span className="text-texto-suave">
                                                            ({formatearMonto(Number(personalPorSalida))} ÷ {paxBase} pasajeros)
                                                        </span>
                                                    </div>
                                                    <span className="font-semibold text-navegacion">
                                                        {formatearMonto(personalPorPasajero)}
                                                    </span>
                                                </li>
                                            ) : null}
                                            {otrosPax > 0 ? (
                                                <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                                                    <span className="font-semibold text-texto">Permisos y otros</span>
                                                    <span className="font-semibold text-navegacion">
                                                        {formatearMonto(otrosPax)}
                                                    </span>
                                                </li>
                                            ) : null}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-texto-suave">
                                            Sin costos de servicios para sumar.
                                        </p>
                                    )}
                                    {!personalPorPasajero && !otrosPax ? (
                                        <p className="text-xs text-amber-700">
                                            Solo servicios de proveedores: sin personal ni permisos, la tarifa sugerida queda corta.
                                        </p>
                                    ) : null}

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-2.5">
                                        <div className="flex flex-wrap items-baseline gap-4 text-sm">
                                            <span>
                                                Costo:{" "}
                                                <strong className="text-navegacion">
                                                    {formatearMonto(costoEstimado ?? simulacion.costoPorPasajero)}
                                                </strong>
                                            </span>
                                            {tarifaSugerida != null ? (
                                                <span>
                                                    Tarifa sugerida (+{margenPorcentaje || 0}%):{" "}
                                                    <strong className="text-marca">
                                                        {formatearMonto(tarifaSugerida)}
                                                    </strong>
                                                </span>
                                            ) : null}
                                        </div>
                                        {tarifaSugerida != null ? (
                                            <Boton
                                                type="button"
                                                variante="secundario"
                                                className="px-3 py-1 text-xs"
                                                onClick={aplicarTarifaSugeridaATodas}
                                            >
                                                Aplicar sugerida
                                            </Boton>
                                        ) : null}
                                    </div>
                                </div>
                            ) : simularMutation.isPending ? (
                                <p className="text-xs text-texto-suave">Calculando costo...</p>
                            ) : null}
                        </div>

                        {/* Matriz de precios por temporada */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-navegacion">
                                    Tarifas por temporada (USD) *
                                </h3>
                                <Boton
                                    type="button"
                                    variante="secundario"
                                    className="px-3 py-1.5 text-xs"
                                    onClick={agregarFilaPrecio}
                                    disabled={filasPrecios.length >= temporadasActivas.length}
                                >
                                    + Agregar temporada
                                </Boton>
                            </div>

                            <div className="space-y-2">
                                {filasPrecios.map((fila, indice) => {
                                    const montoNum = Number(fila.monto);
                                    const bajoCosto =
                                        costoEstimado !== null &&
                                        fila.monto.trim() !== "" &&
                                        Number.isFinite(montoNum) &&
                                        montoNum < costoEstimado;

                                    return (
                                        <div
                                            key={indice}
                                            className={`grid items-end gap-3 rounded-control border p-3 sm:grid-cols-[1.6fr_1fr_auto] ${
                                                bajoCosto
                                                    ? "border-peligro bg-peligro/5"
                                                    : "border-borde bg-white"
                                            }`}
                                        >
                                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                                Temporada
                                                <select
                                                    value={fila.idtemporada}
                                                    onChange={(e) =>
                                                        actualizarFilaPrecio(indice, {
                                                            idtemporada: Number(e.target.value),
                                                        })
                                                    }
                                                    className="rounded-control border border-borde bg-white px-3 py-2 text-sm font-normal"
                                                >
                                                    <option value={0}>Elegí una temporada...</option>
                                                    {temporadasActivas.map((temp) => (
                                                        <option
                                                            key={temp.idtemporada}
                                                            value={temp.idtemporada}
                                                        >
                                                            {temp.nombre} (
                                                            {formatearRangoFechasUtc(
                                                                temp.fechaInicio,
                                                                temp.fechaFin,
                                                            )}
                                                            )
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="grid gap-1 text-xs font-semibold text-texto">
                                                Tarifa por pasajero (USD)
                                                <input
                                                    type="number"
                                                    min={0.01}
                                                    step="0.01"
                                                    value={fila.monto}
                                                    onChange={(e) =>
                                                        actualizarFilaPrecio(indice, {
                                                            monto: e.target.value,
                                                        })
                                                    }
                                                    placeholder="Ej. 650"
                                                    className={`rounded-control border bg-white px-3 py-2 text-sm font-normal outline-none ${
                                                        bajoCosto
                                                            ? "border-peligro text-peligro focus:ring-2 focus:ring-peligro/20"
                                                            : "border-borde focus:border-marca focus:ring-2 focus:ring-marca/20"
                                                    }`}
                                                />
                                                {bajoCosto && costoEstimado !== null ? (
                                                    <span className="text-[11px] font-semibold text-peligro">
                                                        Por debajo del costo (
                                                        {formatearMonto(costoEstimado)})
                                                    </span>
                                                ) : null}
                                            </label>

                                            {filasPrecios.length > 1 ? (
                                                <Boton
                                                    type="button"
                                                    variante="peligroSuave"
                                                    className="px-2.5 py-2 text-xs"
                                                    onClick={() => quitarFilaPrecio(indice)}
                                                >
                                                    Quitar
                                                </Boton>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : null}
            </AsistentePasos>
        </form>
    );
}

export default FormularioPaquete;
