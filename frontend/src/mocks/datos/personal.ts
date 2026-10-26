import type { CuentaGuia } from "../../services/cuentaGuiaService";
import type { Personal } from "../../services/personalService";

export const personalSemilla: Personal[] = [
    {
        id: 1,
        idpersonal: 1,
        nombreCompleto: "Carlos Mamani",
        nroPasaporte: "P123456",
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: "2031-12-31",
        estado: "ACTIVO",
        rol: "Guía",
        guia: {
            nroHabilitacion: "HAB-001",
            fechaHabilitacion: "2028-12-31",
        },
        nroHabilitacion: "HAB-001",
        fechaHabilitacion: "2028-12-31",
    },
    {
        id: 2,
        idpersonal: 2,
        nombreCompleto: "Mateo Quispe",
        nroPasaporte: "P654321",
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: "2030-06-15",
        estado: "ACTIVO",
        rol: "Porteador",
        guia: null,
    },
    {
        id: 3,
        idpersonal: 3,
        nombreCompleto: "Rosa Huamán",
        nroPasaporte: "P789012",
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: "2029-09-20",
        estado: "ACTIVO",
        rol: "Guía",
        guia: {
            nroHabilitacion: "HAB-002",
            fechaHabilitacion: "2027-11-30",
        },
        nroHabilitacion: "HAB-002",
        fechaHabilitacion: "2027-11-30",
    },
    {
        id: 4,
        idpersonal: 4,
        nombreCompleto: "Javier Condori",
        nroPasaporte: "P345678",
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: "2029-04-10",
        estado: "ACTIVO",
        rol: "Guía",
        guia: {
            nroHabilitacion: "HAB-003",
            fechaHabilitacion: "2025-05-10",
        },
        nroHabilitacion: "HAB-003",
        fechaHabilitacion: "2025-05-10",
    },
    {
        id: 5,
        idpersonal: 5,
        nombreCompleto: "Pedro Yupanqui",
        nroPasaporte: "P901234",
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: "2030-11-05",
        estado: "ACTIVO",
        rol: "Porteador",
        guia: null,
    },
    {
        id: 6,
        idpersonal: 6,
        nombreCompleto: "Ana Condori",
        nroPasaporte: "P456789",
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: "2031-08-20",
        estado: "ACTIVO",
        rol: "Guía",
        guia: {
            nroHabilitacion: "HAB-004",
            fechaHabilitacion: "2029-03-15",
        },
        nroHabilitacion: "HAB-004",
        fechaHabilitacion: "2029-03-15",
    },
];

/**
 * Cantidad de salidas no finalizadas (PUBLICADA, ABIERTA, CERRADA, EN_CURSO)
 * por idpersonal para simular las validaciones de CU-25 y CU-46 en MSW.
 */
export const salidasActivasPorPersonal: Record<number, number> = {
    3: 1,
    5: 1,
};

export const cuentasGuiaSemilla: CuentaGuia[] = [
    {
        id: 3,
        idusuario: 3,
        email: "carlos.guia@incatour.com",
        nombre: "Carlos",
        apellido: "Mamani",
        rol: "GUIA",
        estado: "ACTIVO",
        creadoEn: "2026-01-15T10:00:00.000Z",
        guia: {
            idpersonal: 1,
            nombreCompleto: "Carlos Mamani",
            nroPasaporte: "P123456",
            estadoPersonal: "ACTIVO",
        },
        habilitacion: {
            nroHabilitacion: "HAB-001",
            fechaHabilitacion: "2028-12-31T00:00:00.000Z",
            situacion: "VIGENTE",
        },
        salidasPendientes: 0,
        puedeDarseDeBaja: true,
    },
    {
        id: 4,
        idusuario: 4,
        email: "rosa.guia@incatour.com",
        nombre: "Rosa",
        apellido: "Huamán",
        rol: "GUIA",
        estado: "ACTIVO",
        creadoEn: "2026-02-10T14:30:00.000Z",
        guia: {
            idpersonal: 3,
            nombreCompleto: "Rosa Huamán",
            nroPasaporte: "P789012",
            estadoPersonal: "ACTIVO",
        },
        habilitacion: {
            nroHabilitacion: "HAB-002",
            fechaHabilitacion: "2027-11-30T00:00:00.000Z",
            situacion: "VIGENTE",
        },
        salidasPendientes: 1,
        puedeDarseDeBaja: false,
    },
    {
        id: 5,
        idusuario: 5,
        email: "javier.guia@incatour.com",
        nombre: "Javier",
        apellido: "Condori",
        rol: "GUIA",
        estado: "ACTIVO",
        creadoEn: "2026-02-20T09:15:00.000Z",
        guia: {
            idpersonal: 4,
            nombreCompleto: "Javier Condori",
            nroPasaporte: "P345678",
            estadoPersonal: "ACTIVO",
        },
        habilitacion: {
            nroHabilitacion: "HAB-003",
            fechaHabilitacion: "2025-05-10T00:00:00.000Z",
            situacion: "VENCIDA",
        },
        salidasPendientes: 0,
        puedeDarseDeBaja: true,
    },
];

