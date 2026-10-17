import type {
  SalidaResumenAdmin,
  EvaluablesSalidaRespuesta,
  ReseniaClienteItem,
  EvaluacionPersonalListado,
  EvaluacionProveedorListado,
} from "../../services/evaluacionService";

export const salidasMockIniciales: SalidaResumenAdmin[] = [
  {
    idsalida: 1,
    idpaquete: 1,
    nroSalida: "SAL-2026-001",
    fechaInicio: "2026-11-15T00:00:00.000Z",
    fechaFin: "2026-11-18T00:00:00.000Z",
    estado: "PUBLICADA",
    paquete: {
      nroPaquete: "PAQ-INC-01",
      nombrePaquete: "Inca Clásico Standard",
    },
  },
  {
    idsalida: 2,
    idpaquete: 1,
    nroSalida: "SAL-2026-000",
    fechaInicio: "2026-10-01T00:00:00.000Z",
    fechaFin: "2026-10-04T00:00:00.000Z",
    estado: "FINALIZADA",
    paquete: {
      nroPaquete: "PAQ-INC-01",
      nombrePaquete: "Inca Clásico Standard",
    },
  },
];

export const evaluablesPorSalidaInicial: Record<number, EvaluablesSalidaRespuesta> = {
  2: {
    salida: {
      idsalida: 2,
      nroSalida: "SAL-2026-000",
    },
    personal: [
      {
        idpersonal: 1,
        nombreCompleto: "Carlos Mamani",
        rol: "Guía",
        evaluacion: null,
      },
      {
        idpersonal: 2,
        nombreCompleto: "Luis Quispe",
        rol: "Porteador",
        evaluacion: {
          idsalida: 2,
          puntaje: 5,
          comentario: "Excelente puntualidad y compromiso con el grupo",
          fechaEvaluacion: "2026-10-05T14:00:00.000Z",
        },
      },
    ],
    proveedores: [
      {
        idproveedor: 1,
        razonSocial: "Andes Travel",
        evaluacion: null,
      },
    ],
  },
};

export const reseniasIniciales: ReseniaClienteItem[] = [
  {
    idcliente: 1,
    idsalida: 2,
    valoracion: 5,
    comentario: "Experiencia inolvidable en el Camino del Inca. Los guías y campamentos impecables.",
    fechaEnvio: "2026-10-06T10:30:00.000Z",
    cliente: {
      idcliente: 1,
      usuario: {
        nombre: "Juan",
        apellido: "Pérez",
      },
    },
    salida: {
      idsalida: 2,
      nroSalida: "SAL-2026-000",
      fechaInicio: "2026-10-01T00:00:00.000Z",
      paquete: {
        idpaquete: 1,
        nombrePaquete: "Inca Clásico Standard",
      },
    },
  },
];

export const evaluacionesPersonalIniciales: EvaluacionPersonalListado[] = [
  {
    idsalida: 2,
    idpersonal: 2,
    puntaje: 5,
    comentario: "Excelente puntualidad y compromiso con el grupo",
    fechaEvaluacion: "2026-10-05T14:00:00.000Z",
    personal: {
      nombreCompleto: "Luis Quispe",
      rol: "Porteador",
    },
    salida: {
      nroSalida: "SAL-2026-000",
    },
  },
];

export const evaluacionesProveedoresIniciales: EvaluacionProveedorListado[] = [];
