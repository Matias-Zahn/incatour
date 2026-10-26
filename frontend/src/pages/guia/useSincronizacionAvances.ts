import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorApi } from "../../services/clienteApi";
import {
    eliminarAvanceOffline,
    eliminarHistorialLocalAvance,
    obtenerAvancesOffline,
    useRegistrarAvance,
    type AvanceOffline,
} from "../../services/guiaService";

const leerCola = (idsalida: number): AvanceOffline[] => (idsalida > 0 ? obtenerAvancesOffline(idsalida) : []);

// FE-38: los avisos llevan un orden para que en la vista se muestre el último (la sincronización reemplaza
// al "guardado offline" y un aviso nuevo de la vista reemplaza al de la sincronización)
let ultimoOrden = 0;
export const siguienteOrdenAviso = () => ++ultimoOrden;

export type MensajeSincronizacion = { tipo: "exito" | "error"; texto: string; orden: number };

export type SincronizacionAvances = {
    pendientes: AvanceOffline[];
    sincronizando: boolean;
    mensaje: MensajeSincronizacion | null;
    limpiarMensaje: () => void;
    sincronizar: () => Promise<void>;
    /** Vuelve a leer la cola después de encolar un avance */
    refrescar: () => void;
};

/**
 * FE-38: la cola de avances offline se sincroniza desde el portal del guía, al entrar y cada vez que vuelve la señal,
 * esté abierta la vista que esté (antes solo con "Novedades" abierta).
 */
export function useSincronizacionAvances(idsalida: number): SincronizacionAvances {
    // mutateAsync es estable: el efecto de abajo no se vuelve a disparar con cada cambio de la mutación
    const { mutateAsync: registrarAvance } = useRegistrarAvance();
    // La cola se guarda junto con su salida: si cambia la salida, se lee la cola de la nueva
    const [cola, setCola] = useState(() => ({ idsalida, lista: leerCola(idsalida) }));
    const pendientes = cola.idsalida === idsalida ? cola.lista : leerCola(idsalida);
    const [sincronizando, setSincronizando] = useState(false);
    // El aviso es de la salida en la que se sincronizó: al cambiar de salida no se muestra
    const [aviso, setAviso] = useState<(MensajeSincronizacion & { idsalida: number }) | null>(null);
    const mensaje = aviso?.idsalida === idsalida ? aviso : null;
    const limpiarMensaje = useCallback(() => setAviso(null), []);
    // FE-40: un segundo "online" o un clic mientras sincroniza no reenvía la cola
    const enCurso = useRef(false);

    const refrescar = useCallback(() => {
        setCola({ idsalida, lista: leerCola(idsalida) });
    }, [idsalida]);

    const sincronizar = useCallback(async () => {
        if (idsalida <= 0 || enCurso.current) return;
        const envio = leerCola(idsalida);
        if (envio.length === 0) return;

        enCurso.current = true;
        setSincronizando(true);
        let exitoCount = 0;
        let rechazo: string | null = null;

        for (const item of envio) {
            try {
                await registrarAvance({
                    idsalida,
                    payload: {
                        numeroOrden: item.numeroOrden,
                        estadoTramo: item.estadoTramo,
                        fechaHoraLlegada: item.fechaHoraLlegada,
                    },
                });
                eliminarAvanceOffline(idsalida, item.idLocal);
                exitoCount += 1;
            } catch (error) {
                // FE-40: un envío anterior llegó al servidor pero se perdió la respuesta: ya está registrado
                if (error instanceof ErrorApi && error.estado === 400 && error.message.includes("ya se informó")) {
                    eliminarAvanceOffline(idsalida, item.idLocal);
                    exitoCount += 1;
                    continue;
                }
                // 4xx = rechazo definitivo del back: se descarta SOLO ese avance y se corta, porque los
                // siguientes dependen del orden de etapas y se rechazarían en cadena.
                // 401/408/409/429 (409: otro avance se registró al mismo tiempo), red y 5xx se reintentan después.
                if (
                    error instanceof ErrorApi &&
                    error.estado >= 400 &&
                    error.estado < 500 &&
                    ![401, 408, 409, 429].includes(error.estado)
                ) {
                    eliminarAvanceOffline(idsalida, item.idLocal);
                    eliminarHistorialLocalAvance(idsalida, item.idLocal);
                    rechazo = `${item.etapaNombre}: ${error.message}`;
                    break;
                }
                console.error("Error sincronizando avance", error);
                break;
            }
        }

        const restantes = leerCola(idsalida);
        setCola({ idsalida, lista: restantes });
        setSincronizando(false);
        enCurso.current = false;

        if (rechazo) {
            setAviso({
                idsalida,
                orden: siguienteOrdenAviso(),
                tipo: "error",
                texto: `El servidor rechazó un avance pendiente y se descartó (${rechazo}).${restantes.length > 0 ? " Los demás siguen pendientes y se reintentan en la próxima sincronización." : ""}`,
            });
        } else if (exitoCount > 0) {
            setAviso({
                idsalida,
                orden: siguienteOrdenAviso(),
                tipo: "exito",
                texto: `Se sincronizaron exitosamente ${exitoCount} avance(s) pendiente(s) con el servidor.`,
            });
        }
    }, [idsalida, registrarAvance]);

    // Al entrar al portal (o cambiar de salida) con señal, y cada vez que vuelve la conexión
    useEffect(() => {
        if (idsalida <= 0) return;
        const manejarOnline = () => void sincronizar();
        // El primer intento va en un timeout para no actualizar estado dentro del cuerpo del efecto
        const inicial = navigator.onLine ? setTimeout(manejarOnline, 0) : undefined;
        window.addEventListener("online", manejarOnline);
        return () => {
            clearTimeout(inicial);
            window.removeEventListener("online", manejarOnline);
        };
    }, [idsalida, sincronizar]);

    return { pendientes, sincronizando, mensaje, limpiarMensaje, sincronizar, refrescar };
}
