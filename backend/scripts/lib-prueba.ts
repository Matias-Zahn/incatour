/**
 * Infraestructura compartida por las pruebas contra la API real (test:humo y test:integral):
 * resetear una base aparte, levantar el back sobre ella y llamar a la API.
 * Nunca usa incatour_db: la base sale del nombre que recibe cada prueba.
 */
import { execSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import "dotenv/config";

export type Respuesta = { status: number; body: any; error: string };

export const resumen = (b: any) => (typeof b === "string" ? b : JSON.stringify(b?.error ?? b)).slice(0, 160);

// Busca un id en la respuesta, esté arriba o anidado (data.salida.idsalida, data.usuario.idusuario...)
export function idDe(obj: any, campo: string): number | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  if (typeof obj[campo] === "number") return obj[campo];
  for (const v of Object.values(obj)) {
    const id = idDe(v, campo);
    if (id !== undefined) return id;
  }
  return undefined;
}

export function crearEntorno(nombreDb: string) {
  const DB_URL = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, `/${nombreDb}$1`);
  if (/\/incatour_db(\?|$)/.test(DB_URL)) throw new Error("La prueba no puede correr sobre incatour_db");
  const env = { ...process.env, DATABASE_URL: DB_URL, DB_NAME: nombreDb };

  function resetear({ seed = true } = {}) {
    console.log(`Reseteando ${nombreDb} (migraciones${seed ? " + seed" : ""})...`);
    execSync("npx prisma migrate reset --force --skip-generate --skip-seed", { env, stdio: "ignore" });
    if (seed) execSync("npx tsx prisma/seed.ts", { env, stdio: "ignore" });
  }

  // Levanta un back sobre la base de la prueba. extraEnv permite, por ejemplo, AUTORIDAD_CAIDA=true
  async function levantarBack(puerto: number, extraEnv: Record<string, string> = {}) {
    const base = `http://localhost:${puerto}/api`;
    const log = path.join(os.tmpdir(), `${nombreDb}-${puerto}-back.log`);
    let salida = "";
    let caido = "";
    let terminando = false;
    // detached fuera de Windows: el back queda en su propio grupo de procesos y se mata entero (shell → npx → tsx → node)
    const server = spawn("npx", ["tsx", "src/app.ts"], { env: { ...env, PORT: String(puerto), ...extraEnv }, shell: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.on("data", (d) => (salida += d));
    server.stderr.on("data", (d) => (salida += d));
    server.on("exit", (code) => { if (!terminando) caido = `el back del puerto ${puerto} se cayó (código ${code})`; });

    // Primera línea útil del error que imprimió el back mientras atendía el pedido
    function errorDelBack(desde: number) {
      const lineas = salida.slice(desde).split("\n").filter((l) => !/^\s*at /.test(l));
      const linea = lineas.find((l) => /Unknown (argument|field)|Invalid value|must not be null|does not exist|violates/i.test(l))
        ?? lineas.find((l) => /Error/.test(l));
      return linea ? `\n      back: ${linea.trim().slice(0, 200)}` : "";
    }

    async function llamar(metodo: string, ruta: string, body?: unknown, tok = ""): Promise<Respuesta> {
      if (caido) throw new Error(`No sigo: ${caido}`);
      const desde = salida.length;
      let r: Response;
      try {
        r = await fetch(base + ruta, {
          method: metodo,
          headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        await new Promise((res) => setTimeout(res, 500));
        caido ||= `el back del puerto ${puerto} cortó la conexión`;
        throw new Error(`${caido} en ${metodo} ${ruta}`);
      }
      const texto = await r.text();
      let cuerpo: any = texto;
      try { cuerpo = JSON.parse(texto); } catch { /* sin JSON */ }
      if (r.status >= 500) await new Promise((res) => setTimeout(res, 100)); // que llegue el log
      return { status: r.status, body: cuerpo, error: r.status >= 500 ? errorDelBack(desde) : "" };
    }

    async function login(email: string, contrasenia: string) {
      const r = await llamar("POST", "/auth/login", { email, contrasenia });
      if (r.status !== 200) throw new Error(`No se pudo entrar como ${email}: ${resumen(r.body)}`);
      return r.body.data.token as string;
    }

    function apagar() {
      terminando = true;
      fs.writeFileSync(log, salida);
      // En Windows hay que matar el árbol (npx → tsx → node)
      if (process.platform === "win32" && server.pid) {
        try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" }); } catch { /* ya terminó */ }
      } else if (server.pid) {
        try { process.kill(-server.pid, "SIGTERM"); } catch { /* ya terminó */ }
      }
    }

    for (let i = 0; i < 60; i++) {
      try { await fetch(`${base}/catalogo`); return { base, log, llamar, login, apagar }; } catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    apagar();
    throw new Error(`El back del puerto ${puerto} no arrancó (log: ${log})`);
  }

  return { DB_URL, resetear, levantarBack };
}

export type Back = Awaited<ReturnType<ReturnType<typeof crearEntorno>["levantarBack"]>>;
