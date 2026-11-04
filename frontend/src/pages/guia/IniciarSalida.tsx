import { useState } from "react";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import { formatearFechaSalida, puedeIniciarSalida, useIniciarSalida } from "../../services/guiaService";

type IniciarSalidaProps = {
    salida: { idsalida: number; nroSalida: string; estado: string; fechaInicio?: string } | null;
    /** Texto que explica por qué hace falta iniciarla en esta vista */
    motivo?: string;
};

// CU-49: la salida empieza cuando el guía dice que el grupo partió, no con el primer avance.
// ponytail: necesita señal; si el punto de partida no tiene, sumarlo a la cola offline como los avances
export function IniciarSalida({ salida, motivo }: IniciarSalidaProps) {
    const [confirmando, setConfirmando] = useState(false);
    const iniciar = useIniciarSalida();

    if (!salida || (salida.estado !== "PUBLICADA" && salida.estado !== "CERRADA")) return null;

    if (!puedeIniciarSalida(salida)) {
        return (
            <Alerta tipo="informacion">
                {motivo ? `${motivo} ` : ""}La salida se puede iniciar desde el {formatearFechaSalida(salida.fechaInicio)}.
            </Alerta>
        );
    }

    const error = iniciar.error instanceof Error ? iniciar.error.message : null;
    return (
        <div className="space-y-3 rounded-tarjeta border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
                {motivo ? `${motivo} ` : ""}Iniciá la salida cuando el grupo parta: desde ahí se cuentan los tiempos del recorrido.
            </p>
            {error ? <Alerta tipo="error">{error}</Alerta> : null}
            <Boton
                onClick={() => setConfirmando(true)}
                cargando={iniciar.isPending}
                disabled={!navigator.onLine}
                title={navigator.onLine ? undefined : "Sin conexión: iniciar la salida necesita señal"}
            >
                Iniciar salida
            </Boton>
            {!navigator.onLine ? (
                <p className="text-xs">Sin conexión: iniciar la salida necesita señal.</p>
            ) : null}
            <DialogoConfirmacion
                abierto={confirmando}
                titulo={`¿Iniciar la salida ${salida.nroSalida}?`}
                descripcion="Se registra ahora como la hora de partida del grupo y no se puede deshacer."
                textoConfirmar="Sí, iniciar"
                textoCancelar="Todavía no"
                cargando={iniciar.isPending}
                onConfirmar={() => iniciar.mutate(salida.idsalida, { onSettled: () => setConfirmando(false) })}
                onCancelar={() => setConfirmando(false)}
            />
        </div>
    );
}
