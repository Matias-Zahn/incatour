import { describe, expect, it } from "vitest";
import { criticosEnCurso, type IncidenteAdmin } from "./guiaService";

const incidente = (id: number, nroSalida: string, nivelGravedad: IncidenteAdmin["nivelGravedad"]) =>
    ({ idincidente: id, nivelGravedad, salida: { nroSalida } }) as IncidenteAdmin;

describe("criticosEnCurso", () => {
    it("cuenta solo los críticos de salidas en curso", () => {
        const salidas = [
            { nroSalida: "SAL-1", estado: "EN_CURSO" },
            { nroSalida: "SAL-2", estado: "FINALIZADA" },
        ];
        const incidentes = [
            incidente(1, "SAL-1", "CRITICO"),
            incidente(2, "SAL-1", "MEDIO"),
            incidente(3, "SAL-2", "CRITICO"),
        ];
        expect(criticosEnCurso(incidentes, salidas).map((i) => i.idincidente)).toEqual([1]);
    });
});
