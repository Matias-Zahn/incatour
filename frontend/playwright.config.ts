import { defineConfig } from "@playwright/test";

// Corre contra la app real: back sobre la base de demo y front con VITE_USE_MOCKS=false (ver docs/pruebas/caja-negra-compra.md)
export default defineConfig({
    testDir: "./e2e",
    workers: 1,
    timeout: 45_000,
    reporter: [["list"]],
    use: {
        baseURL: process.env.URL_FRONT ?? "http://localhost:5191",
        channel: "chrome",
        locale: "es-AR",
        timezoneId: "America/Argentina/Buenos_Aires",
    },
});
