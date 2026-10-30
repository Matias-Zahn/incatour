import { useCallback, useEffect, useRef, useState } from "react";
import {
    eliminarHistorialLocalIncidente,
    eliminarIncidenteOffline,
    obtenerIncidentesOffline,
    useRegistrarIncidente,
    type IncidenteOffline,
} from "../../services/guiaService";
import { esRechazoDefinitivo, siguienteOrdenAviso, type MensajeSincronizacion } from "./useSincronizacionAvances";

const leerCola = (idsalida: number): IncidenteOffline[] => (idsalida > 0 ? obtenerIncidentesOffline(idsalida) : []);

export type SincronizacionIncidentes = {
    pendientes: IncidenteOffline[];
    mensaje: MensajeSincronizacion | null;
    limpiarMensaje: () => void;
    /** Vuelve a leer la cola después de encolar un incidente */
    refrescar: () => void;
};

/**
 * Misma cola que los avances, pero sin orden entre incidentes: si uno falla por la red se corta y se reintenta después.
 * Limitación: si el servidor guardó el incidente y se perdió la respuesta, se reenvía duplicado; evitarlo necesita un id de idempotencia en el back.
 */
export function useSincronizacionIncidentes(idsalida: number): SincronizacionIncidentes {
    const { mutateAsync: registrarIncidente } = useRegistrarIncidente();
    const [cola, setCola] = useState(() => ({ idsalida, lista: leerCola(idsalida) }));
    const pendientes = cola.idsalida === idsalida ? cola.lista : leerCola(idsalida);
    const [aviso, setAviso] = useState<(MensajeSincronizacion & { idsalida: number }) | null>(null);
    const mensaje = aviso?.idsalida === idsalida ? aviso : null;
    const limpiarMensaje = useCallback(() => setAviso(null), []);
    const enCurso = useRef(false);

    const refrescar = useCallback(() => {
        setCola({ idsalida, lista: leerCola(idsalida) });
    }, [idsalida]);

    const sincronizar = useCallback(async () => {
        if (idsalida <= 0 || enCurso.current) return;
        const envio = leerCola(idsalida);
        if (envio.length === 0) return;

        enCurso.current = true;
        let enviados = 0;
        let rechazo: string | null = null;

        for (const item of envio) {
            try {
                await registrarIncidente({ idsalida, payload: item.payload });
                eliminarIncidenteOffline(idsalida, item.idLocal);
                enviados += 1;
            } catch (error) {
                if (esRechazoDefinitivo(error)) {
                    eliminarIncidenteOffline(idsalida, item.idLocal);
                    eliminarHistorialLocalIncidente(idsalida, item.idLocal);
                    rechazo = error.message;
                    continue;
                }
                console.error("Error sincronizando incidente", error);
                break;
            }
        }

        setCola({ idsalida, lista: leerCola(idsalida) });
        enCurso.current = false;

        if (rechazo) {
            setAviso({ idsalida, orden: siguienteOrdenAviso(), tipo: "error", texto: `El servidor rechazó un incidente pendiente y se descartó (${rechazo}).` });
        } else if (enviados > 0) {
            setAviso({ idsalida, orden: siguienteOrdenAviso(), tipo: "exito", texto: `Se enviaron ${enviados} incidente(s) pendiente(s) al equipo de administración.` });
        }
    }, [idsalida, registrarIncidente]);

    useEffect(() => {
        if (idsalida <= 0) return;
        const manejarOnline = () => void sincronizar();
        const inicial = navigator.onLine ? setTimeout(manejarOnline, 0) : undefined;
        window.addEventListener("online", manejarOnline);
        return () => {
            clearTimeout(inicial);
            window.removeEventListener("online", manejarOnline);
        };
    }, [idsalida, sincronizar]);

    return { pendientes, mensaje, limpiarMensaje, refrescar };
}
