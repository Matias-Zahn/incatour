/**
 * Bloque 8: regresión del bug de plazas en un alojamiento "a solicitud".
 * Antes: dejar plazas vacío generaba NaN y trababa el envío en silencio al cambiar a A_SOLICITUD.
 * Ahora: los campos numéricos vacíos valen undefined, al elegir A_SOLICITUD se limpia capacidadDisponible
 * y el POST no manda el campo (sin parche de 0).
 */
import { expect, test } from "@playwright/test";

test("B8: crear un hotel a solicitud sin plazas funciona y no envía capacidadDisponible", async ({ page }) => {
    const nombreHotel = `Hotel Solicitud ${Date.now() % 100000}`;
    let payloadEnviado: Record<string, unknown> | null = null;

    page.on("request", (req) => {
        if (req.method() === "POST" && /\/proveedores\/\d+\/servicios$/.test(req.url())) {
            payloadEnviado = req.postDataJSON() as Record<string, unknown>;
        }
    });

    // 1. Ingresar como administrador
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@incatour.com");
    await page.locator('input[type="password"]').fill("AdminIncaTour123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL((url) => !url.pathname.includes("login"));

    // 2. Ir a los servicios de un proveedor de ALOJAMIENTO
    await page.goto("/gestion/proveedores");
    const filaAlojamiento = page.locator("article", { hasText: /ALOJAMIENTO/i }).first();
    await expect(filaAlojamiento).toBeVisible({ timeout: 10_000 });
    await filaAlojamiento.getByRole("link", { name: /Servicios/i }).click();
    await page.waitForURL(/\/gestion\/proveedores\/\d+\/servicios/);

    // 3. Abrir el alta de servicio
    await page.getByRole("button", { name: "Nuevo servicio" }).click();

    // 4. Completar los datos dejando plazas vacío en BLOQUEO_PLAZAS, luego cambiar a A_SOLICITUD
    await page.getByLabel("Nombre del servicio").fill(nombreHotel);
    await page.getByLabel("Localidad").fill("Cusco");
    await page.getByLabel("Costo base").fill("95");
    await page.getByLabel("Categoría").selectOption("3 Estrellas");
    await page.getByLabel("Tipo de habitación").fill("Doble");

    // Verificar que primero aparece el campo de plazas (BLOQUEO_PLAZAS) y luego desaparece al pasar a A_SOLICITUD
    await expect(page.getByLabel("Capacidad disponible (plazas)")).toBeVisible();
    await page.getByLabel("Modalidad de confirmación").selectOption("A_SOLICITUD");
    await expect(page.getByLabel("Capacidad disponible (plazas)")).toHaveCount(0);

    // 5. Guardar y verificar que se crea sin mandar capacidadDisponible
    await page.getByRole("button", { name: "Guardar servicio" }).click();

    await expect(page.getByText(nombreHotel)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("tbody tr", { hasText: nombreHotel })).toContainText("A solicitud");
    expect(payloadEnviado).not.toBeNull();
    expect(payloadEnviado).not.toHaveProperty("capacidadDisponible");
    expect(payloadEnviado).toMatchObject({
        tipo: "ALOJAMIENTO",
        nombreServicio: nombreHotel,
        modalidadConfirmacion: "A_SOLICITUD",
    });
});
