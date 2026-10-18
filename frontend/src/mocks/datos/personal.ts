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
];

export const cuentasGuiaSemilla: CuentaGuia[] = [
    {
        id: 4,
        idusuario: 4,
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
        id: 5,
        idusuario: 5,
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
];
