// Exporta la especificación OpenAPI (la misma que sirve /api-docs) a docs/openapi.json.
// Uso, desde backend: npm run docs. Volver a correrlo cuando cambie un endpoint.
import { writeFileSync } from "fs";
import { swaggerSpec } from "../src/config/swagger";

writeFileSync("docs/openapi.json", JSON.stringify(swaggerSpec, null, 2) + "\n");
const rutas = Object.keys((swaggerSpec as { paths?: object }).paths ?? {}).length;
console.log(`docs/openapi.json generado: ${rutas} rutas documentadas`);
