import { http, HttpResponse, delay } from "msw";
import { construirUrl } from "../../services/clienteApi";
import { exigirRol } from "../autorizacion";
import { reservasClienteMock } from "./catalogoReservas";
import {
  salidasMockIniciales,
  evaluablesPorSalidaInicial,
  reseniasIniciales,
  evaluacionesPersonalIniciales,
  evaluacionesProveedoresIniciales,
} from "../datos/evaluaciones";
import type { EvaluarPayload } from "../../services/evaluacionService";
import type {
  ItemHistorialResenia,
  PublicarReseniaPayload,
} from "../../services/clientePortalService";

const salidas = structuredClone(salidasMockIniciales);
const evaluablesPorSalida = structuredClone(evaluablesPorSalidaInicial);
const resenias = structuredClone(reseniasIniciales);
const evaluacionesPersonal = structuredClone(evaluacionesPersonalIniciales);
const evaluacionesProveedores = structuredClone(evaluacionesProveedoresIniciales);

export const manejadoresEvaluaciones = [
  // GET /api/salidas/:idsalida/evaluaciones (CU-42)
  http.get("*/api/salidas/:idsalida/evaluaciones", async ({ params }) => {
    await delay(150);
    const idsalida = Number(params.idsalida);
    const salida = salidas.find((s) => s.idsalida === idsalida);
    if (!salida) {
      return HttpResponse.json({ error: "La salida no existe" }, { status: 404 });
    }
    if (salida.estado !== "FINALIZADA") {
      return HttpResponse.json(
        { error: "Solo se puede evaluar en una salida finalizada" },
        { status: 400 },
      );
    }

    const data = evaluablesPorSalida[idsalida] ?? {
      salida: { idsalida, nroSalida: salida.nroSalida },
      personal: [],
      proveedores: [],
    };
    return HttpResponse.json({ data });
  }),

  // POST /api/salidas/:idsalida/evaluaciones (CU-42)
  http.post("*/api/salidas/:idsalida/evaluaciones", async ({ params, request }) => {
    await delay(200);
    const idsalida = Number(params.idsalida);
    const body = (await request.json()) as EvaluarPayload;
    const evaluables = evaluablesPorSalida[idsalida];

    if (!evaluables) {
      return HttpResponse.json(
        { error: "Solo se puede evaluar en una salida finalizada" },
        { status: 400 },
      );
    }

    const nuevaEval = {
      idsalida,
      puntaje: body.puntaje,
      comentario: body.comentario?.trim() || null,
      fechaEvaluacion: new Date().toISOString(),
    };

    if (body.tipo === "PERSONAL") {
      const persona = evaluables.personal.find((p) => p.idpersonal === body.id);
      if (!persona) {
        return HttpResponse.json(
          { error: "Esa persona no participó de la salida" },
          { status: 400 },
        );
      }
      if (persona.evaluacion) {
        return HttpResponse.json(
          { error: "Esa persona ya fue evaluada en esta salida" },
          { status: 400 },
        );
      }
      persona.evaluacion = nuevaEval;
      evaluacionesPersonal.unshift({
        idsalida,
        idpersonal: persona.idpersonal,
        puntaje: nuevaEval.puntaje,
        comentario: nuevaEval.comentario,
        fechaEvaluacion: nuevaEval.fechaEvaluacion,
        personal: {
          nombreCompleto: persona.nombreCompleto,
          rol: persona.rol,
        },
        salida: {
          nroSalida: evaluables.salida.nroSalida,
        },
      });
      return HttpResponse.json(
        { mensaje: "Evaluación registrada", data: nuevaEval },
        { status: 201 },
      );
    }

    const prov = evaluables.proveedores.find((p) => p.idproveedor === body.id);
    if (!prov) {
      return HttpResponse.json(
        { error: "Ese proveedor no dio ningún servicio en la salida" },
        { status: 400 },
      );
    }
    if (prov.evaluacion) {
      return HttpResponse.json(
        { error: "Ese proveedor ya fue evaluado en esta salida" },
        { status: 400 },
      );
    }
    prov.evaluacion = nuevaEval;
    evaluacionesProveedores.unshift({
      idsalida,
      idproveedor: prov.idproveedor,
      puntaje: nuevaEval.puntaje,
      comentario: nuevaEval.comentario,
      fechaEvaluacion: nuevaEval.fechaEvaluacion,
      proveedor: {
        razonSocial: prov.razonSocial,
      },
      salida: {
        nroSalida: evaluables.salida.nroSalida,
      },
    });
    return HttpResponse.json(
      { mensaje: "Evaluación registrada", data: nuevaEval },
      { status: 201 },
    );
  }),

  // GET /api/resenias/historial-reservas (CU-47, pasos 1 a 4)
  http.get(construirUrl("/resenias/historial-reservas"), async ({ request }) => {
    const denegado = exigirRol(request, "CLIENTE");
    if (denegado) return denegado;
    await delay(150);

    const historial: ItemHistorialResenia[] = reservasClienteMock.map((r) => {
      const reseniaExistente =
        resenias.find(
          (res) => res.idcliente === 1 && res.idsalida === r.salida.idsalida,
        ) ?? null;

      const resenia = reseniaExistente
        ? {
            idcliente: reseniaExistente.idcliente,
            idsalida: reseniaExistente.idsalida,
            valoracion: reseniaExistente.valoracion,
            comentario: reseniaExistente.comentario,
            fechaEnvio: reseniaExistente.fechaEnvio,
          }
        : null;

      return {
        idreserva: r.idreserva,
        nroReserva: r.nroReserva,
        estadoReserva: r.estado,
        salida: {
          ...r.salida,
          paquete: r.paquete,
        },
        resenia,
        puedeResenar:
          r.estado === "CONFIRMADA" &&
          r.salida.estado === "FINALIZADA" &&
          !resenia,
      };
    });

    return HttpResponse.json({ data: historial });
  }),

  // POST /api/resenias (CU-47, pasos 11 a 14)
  http.post(construirUrl("/resenias"), async ({ request }) => {
    const denegado = exigirRol(request, "CLIENTE");
    if (denegado) return denegado;
    await delay(200);

    const body = (await request.json()) as Partial<PublicarReseniaPayload>;
    const idsalida = Number(body.idsalida);
    const valoracion = Number(body.valoracion);
    const comentarioRaw = body.comentario;

    if (!Number.isInteger(idsalida) || idsalida <= 0) {
      return HttpResponse.json(
        { error: "idsalida es requerido y debe ser un número entero." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(valoracion) || valoracion < 1 || valoracion > 5) {
      return HttpResponse.json(
        { error: "La valoración debe ser un número entero entre 1 y 5." },
        { status: 400 },
      );
    }

    let comentario: string | null = null;
    if (
      comentarioRaw !== undefined &&
      comentarioRaw !== null &&
      comentarioRaw !== ""
    ) {
      if (typeof comentarioRaw !== "string") {
        return HttpResponse.json(
          { error: "El comentario debe ser un texto." },
          { status: 400 },
        );
      }
      comentario = comentarioRaw.trim();
      if (comentario.length > 1000) {
        return HttpResponse.json(
          { error: "El comentario no puede superar los 1000 caracteres." },
          { status: 400 },
        );
      }
      if (comentario.length === 0) comentario = null;
    }

    const reservaConfirmada = reservasClienteMock.find(
      (r) => r.salida.idsalida === idsalida && r.estado === "CONFIRMADA",
    );
    if (!reservaConfirmada) {
      return HttpResponse.json(
        {
          error:
            "Solo podés reseñar salidas en las que participaste con una reserva confirmada.",
        },
        { status: 403 },
      );
    }

    if (reservaConfirmada.salida.estado !== "FINALIZADA") {
      return HttpResponse.json(
        { error: "Solo se pueden reseñar salidas finalizadas." },
        { status: 400 },
      );
    }

    const yaExiste = resenias.some(
      (r) => r.idcliente === 1 && r.idsalida === idsalida,
    );
    if (yaExiste) {
      return HttpResponse.json(
        { error: "No es posible registrar más de una reseña por salida." },
        { status: 400 },
      );
    }

    const nuevaResenia = {
      idcliente: 1,
      idsalida,
      valoracion,
      comentario,
      fechaEnvio: new Date().toISOString(),
    };

    resenias.unshift({
      ...nuevaResenia,
      cliente: {
        idcliente: 1,
        usuario: {
          nombre: reservaConfirmada.titular.nombre,
          apellido: reservaConfirmada.titular.apellido,
        },
      },
      salida: {
        idsalida: reservaConfirmada.salida.idsalida,
        nroSalida: reservaConfirmada.salida.nroSalida,
        fechaInicio: reservaConfirmada.salida.fechaInicio,
        paquete: {
          idpaquete: reservaConfirmada.paquete.idpaquete,
          nombrePaquete: reservaConfirmada.paquete.nombrePaquete,
        },
      },
    });

    return HttpResponse.json(
      { mensaje: "Reseña publicada correctamente", data: nuevaResenia },
      { status: 201 },
    );
  }),

  // GET /api/resenias (CU-43)
  http.get("*/api/resenias", async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const idsalida = url.searchParams.get("idsalida")
      ? Number(url.searchParams.get("idsalida"))
      : undefined;
    const idpaquete = url.searchParams.get("idpaquete")
      ? Number(url.searchParams.get("idpaquete"))
      : undefined;
    const valoracionMin = url.searchParams.get("valoracionMin")
      ? Number(url.searchParams.get("valoracionMin"))
      : undefined;
    const valoracionMax = url.searchParams.get("valoracionMax")
      ? Number(url.searchParams.get("valoracionMax"))
      : undefined;

    const reseniasFiltradas = resenias.filter((r) => {
      if (idsalida && r.idsalida !== idsalida) return false;
      if (idpaquete && r.salida.paquete.idpaquete !== idpaquete) return false;
      if (valoracionMin && r.valoracion < valoracionMin) return false;
      if (valoracionMax && r.valoracion > valoracionMax) return false;
      return true;
    });

    const personalFiltrado = evaluacionesPersonal.filter((e) => {
      if (idsalida && e.idsalida !== idsalida) return false;
      if (valoracionMin && e.puntaje < valoracionMin) return false;
      if (valoracionMax && e.puntaje > valoracionMax) return false;
      return true;
    });

    const proveedoresFiltrados = evaluacionesProveedores.filter((e) => {
      if (idsalida && e.idsalida !== idsalida) return false;
      if (valoracionMin && e.puntaje < valoracionMin) return false;
      if (valoracionMax && e.puntaje > valoracionMax) return false;
      return true;
    });

    const cantidad = reseniasFiltradas.length;
    const promedio =
      cantidad === 0
        ? null
        : Number(
            (
              reseniasFiltradas.reduce((acc, r) => acc + r.valoracion, 0) / cantidad
            ).toFixed(2),
          );

    return HttpResponse.json({
      data: {
        resumen: { cantidad, promedio },
        resenias: reseniasFiltradas,
        evaluaciones: {
          personal: personalFiltrado,
          proveedores: proveedoresFiltrados,
        },
      },
    });
  }),
];
