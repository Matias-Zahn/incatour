import { http, HttpResponse, delay } from "msw";
import {
  salidasMockIniciales,
  evaluablesPorSalidaInicial,
  reseniasIniciales,
  evaluacionesPersonalIniciales,
  evaluacionesProveedoresIniciales,
} from "../datos/evaluaciones";
import type { EvaluarPayload } from "../../services/evaluacionService";

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
