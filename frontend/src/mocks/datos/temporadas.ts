import type { Temporada } from "../../services/temporadaService";

export type TemporadaMock = Omit<Temporada, "id"> & {
    tieneTarifasAsociadas?: boolean;
};

export const temporadasIniciales: TemporadaMock[] = [
    {
        idtemporada: 1,
        nombre: "Alta 2026",
        fechaInicio: "2026-10-01T00:00:00.000Z",
        fechaFin: "2026-12-31T23:59:59.000Z",
        estado: "ACTIVO",
        tieneTarifasAsociadas: true,
    },
    {
        idtemporada: 2,
        nombre: "Baja Verano 2027",
        fechaInicio: "2027-01-01T00:00:00.000Z",
        fechaFin: "2027-03-31T23:59:59.000Z",
        estado: "ACTIVO",
        tieneTarifasAsociadas: false,
    },
    {
        idtemporada: 3,
        nombre: "Media Otoño 2027",
        fechaInicio: "2027-04-01T00:00:00.000Z",
        fechaFin: "2027-06-30T23:59:59.000Z",
        estado: "ACTIVO",
        tieneTarifasAsociadas: false,
    },
];
