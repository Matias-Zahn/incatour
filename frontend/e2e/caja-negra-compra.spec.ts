/**
 * Prueba de caja negra de la pantalla de compra (CU-30): se usa como la usaría un cliente, sin mirar el código.
 * Casos por partición de equivalencia (PE) y valores límite (VL). Diseño y resultados: docs/pruebas/caja-negra-compra.md
 * Los casos válidos compran de verdad: consumen lugares de la salida de la base de demo.
 */
import { expect, test, type Page } from "@playwright/test";

const API = process.env.URL_API ?? "http://localhost:3998/api";

type Salida = { idsalida: number; nroSalida: string; fechaFin: string; cupoDisponible: number };
let paquete: string;
let salida: Salida;

const sumarDias = (iso: string, dias: number) => new Date(new Date(iso).getTime() + dias * 864e5).toISOString().slice(0, 10);
let pasaportes = Date.now() % 1000000;

// La salida con más lugares: que los casos válidos no la agoten
test.beforeAll(async ({ request }) => {
    const { data } = await (await request.get(`${API}/catalogo`)).json();
    const opciones = data.flatMap((p: { nombre?: string; nombrePaquete?: string; salidasDisponibles: Salida[] }) =>
        p.salidasDisponibles.map((s) => ({ paquete: p.nombre ?? p.nombrePaquete!, salida: s })),
    );
    const mejor = opciones.sort((a: { salida: Salida }, b: { salida: Salida }) => b.salida.cupoDisponible - a.salida.cupoDisponible)[0];
    paquete = mejor.paquete;
    salida = mejor.salida;
});

async function abrirFormulario(page: Page) {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("juan@test.com");
    await page.locator('input[type="password"]').fill("cliente123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL((url) => !url.pathname.includes("login"));
    await page.goto("/catalogo");
    await page.locator("article", { hasText: paquete }).getByRole("button", { name: "Comprar paquete" }).click();
    await page.getByRole("button", { name: new RegExp(salida.nroSalida) }).click();
    if (!(await page.locator("#pasajero-0-nombre").isVisible())) {
        await page.getByRole("button", { name: "+ Agregar pasajero vacío" }).click();
    }
}

type Datos = Partial<Record<"nombre" | "pasaporte" | "nacionalidad" | "vencimiento" | "equipaje" | "numero" | "titular" | "tarjetaVence" | "cvv", string>>;

async function cargar(page: Page, datos: Datos) {
    const d = {
        nombre: "Lucía Prueba", pasaporte: `CN${pasaportes++}`, nacionalidad: "Argentina", vencimiento: "2036-01-01", equipaje: "8",
        numero: "4242424242424242", titular: "LUCIA PRUEBA", tarjetaVence: "12/30", cvv: "123", ...datos,
    };
    await page.locator("#pasajero-0-nombre").fill(d.nombre);
    await page.locator("#pasajero-0-pasaporte").fill(d.pasaporte);
    await page.locator("#pasajero-0-nacionalidad").fill(d.nacionalidad);
    await page.locator("#pasajero-0-vencimiento").fill(d.vencimiento);
    await page.locator("#pasajero-0-equipaje").fill(d.equipaje);
    await page.locator("#tarjeta-numero").fill(d.numero);
    await page.locator("#tarjeta-titular").fill(d.titular);
    await page.locator("#tarjeta-vencimiento").fill(d.tarjetaVence);
    await page.locator("#tarjeta-cvv").fill(d.cvv);
}

const pagar = (page: Page) => page.getByRole("button", { name: /Confirmar y pagar/ }).click();

const finDeSalida = () => salida.fechaFin.slice(0, 10);

// Los datos de fecha dependen de la salida elegida: por eso van como función
const INVALIDOS: [string, string, () => Datos, string | RegExp][] = [
    ["CN-01", "PE nombre vacío", () => ({ nombre: "" }), "Completá el nombre y apellido."],
    ["CN-02", "VL nombre de solo espacios", () => ({ nombre: "   " }), "Completá el nombre y apellido."],
    ["CN-03", "PE pasaporte vacío", () => ({ pasaporte: "" }), "Completá el número de pasaporte."],
    ["CN-04", "PE nacionalidad vacía", () => ({ nacionalidad: "" }), "Completá la nacionalidad."],
    ["CN-05", "PE vencimiento vacío", () => ({ vencimiento: "" }), "Indicá el vencimiento del pasaporte."],
    ["CN-06", "PE pasaporte ya vencido", () => ({ vencimiento: "2020-01-01" }), /Tiene que vencer después/],
    ["CN-07", "VL vence el día anterior al fin", () => ({ vencimiento: sumarDias(finDeSalida(), -1) }), /Tiene que vencer después/],
    ["CN-08", "VL vence justo el último día", () => ({ vencimiento: finDeSalida() }), /Tiene que vencer después/],
    ["CN-09", "PE equipaje vacío", () => ({ equipaje: "" }), "Indicá el peso del equipaje."],
    ["CN-10", "VL equipaje -0.5 kg", () => ({ equipaje: "-0.5" }), "No puede ser negativo."],
    ["CN-11", "VL equipaje 20.5 kg", () => ({ equipaje: "20.5" }), "El máximo es 20 kg por pasajero."],
    ["CN-12", "PE tarjeta vacía", () => ({ numero: "" }), "Ingresá un número de tarjeta válido."],
    ["CN-13", "VL tarjeta de 11 dígitos", () => ({ numero: "42424242424" }), "Ingresá un número de tarjeta válido."],
    ["CN-14", "VL tarjeta de 14 dígitos", () => ({ numero: "42424242424242" }), /Número de tarjeta inválido/],
    ["CN-15", "VL tarjeta de 17 dígitos", () => ({ numero: "42424242424242421" }), /Número de tarjeta inválido/],
    ["CN-16", "PE tarjeta con letras", () => ({ numero: "4242abcd42424242" }), /Número de tarjeta inválido/],
    ["CN-17", "PE titular vacío", () => ({ titular: "" }), "Ingresá el nombre del titular."],
    ["CN-18", "PE vencimiento sin barra", () => ({ tarjetaVence: "1230" }), "Usá el formato MM/AA (ej. 11/29)."],
    ["CN-19", "VL mes 13", () => ({ tarjetaVence: "13/30" }), /Tarjeta vencida o con vencimiento inválido/],
    ["CN-20", "PE tarjeta vencida", () => ({ tarjetaVence: "01/20" }), /Tarjeta vencida o con vencimiento inválido/],
    ["CN-21", "VL CVV de 2 dígitos", () => ({ cvv: "12" }), "Ingresá el código de seguridad."],
    ["CN-23", "PE CVV con letras", () => ({ cvv: "12a" }), /CVV inválido/],
    ["CN-24", "PE tarjeta sin fondos", () => ({ numero: "4242424242420000" }), /fondos insuficientes/],
    ["CN-25", "PE tarjeta robada", () => ({ numero: "4242424242421111" }), /Pago rechazado/],
    ["CN-26", "PE pago rechazado por CVV", () => ({ cvv: "999" }), /Pago rechazado/],
];

const VALIDOS: [string, string, () => Datos][] = [
    ["CN-27", "PE todos los datos válidos", () => ({})],
    ["CN-28", "VL vence el día siguiente al fin", () => ({ vencimiento: sumarDias(finDeSalida(), 1) })],
    ["CN-29", "VL equipaje 0 kg", () => ({ equipaje: "0" })],
    ["CN-30", "VL equipaje 20 kg", () => ({ equipaje: "20" })],
    ["CN-31", "VL tarjeta de 15 dígitos", () => ({ numero: "424242424242424" })],
    ["CN-32", "VL CVV de 4 dígitos", () => ({ cvv: "1234" })],
    ["CN-33", "PE tarjeta con espacios", () => ({ numero: "4242 4242 4242 4242" })],
];

test.describe("Datos inválidos: no se compra", () => {
    for (const [id, nombre, datos, mensaje] of INVALIDOS) {
        test(`${id} ${nombre}`, async ({ page }) => {
            await abrirFormulario(page);
            await cargar(page, datos());
            await pagar(page);
            await expect(page.getByText(mensaje).first()).toBeVisible({ timeout: 8000 });
            await expect(page.getByText(/Reserva #/)).toHaveCount(0);
        });
    }

    test("CN-22 VL CVV de 5 dígitos: el campo no admite el quinto", async ({ page }) => {
        await abrirFormulario(page);
        await page.locator("#tarjeta-cvv").pressSequentially("12345");
        await expect(page.locator("#tarjeta-cvv")).toHaveValue("1234");
    });

    test("CN-34 PE pasaporte repetido en la nómina", async ({ page }) => {
        await abrirFormulario(page);
        await cargar(page, { pasaporte: "REPETIDO1" });
        await page.getByRole("button", { name: "+ Agregar pasajero vacío" }).click();
        await page.locator("#pasajero-1-nombre").fill("Otro Pasajero");
        await page.locator("#pasajero-1-pasaporte").fill("repetido1");
        await page.locator("#pasajero-1-nacionalidad").fill("Chilena");
        await page.locator("#pasajero-1-vencimiento").fill("2036-01-01");
        await page.locator("#pasajero-1-equipaje").fill("5");
        await pagar(page);
        await expect(page.getByText("Este pasaporte está repetido en la nómina.")).toBeVisible();
    });
});

test.describe("Datos válidos: se compra", () => {
    for (const [id, nombre, datos] of VALIDOS) {
        test(`${id} ${nombre}`, async ({ page }) => {
            await abrirFormulario(page);
            await cargar(page, datos());
            await pagar(page);
            await expect(page.getByText(/Reserva #/)).toBeVisible({ timeout: 10000 });
        });
    }
});
