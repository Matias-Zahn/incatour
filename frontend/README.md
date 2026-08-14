# 🎨 Incatour - Frontend App

Cliente web interactivo para la plataforma **Incatour**, ofreciendo una interfaz para usuarios y administradores en la gestión de paquetes turísticos, reservas del Camino del Inca y logística.

---

## 🛠️ Tecnologías

* **Librería UI:** React 19 (`react`, `react-dom`)
* **Build Tool & Dev Server:** Vite 8 (`vite`)
* **Lenguaje:** TypeScript (`typescript`)
* **Enrutamiento:** React Router DOM v7 (`react-router-dom`)
* **Estilos & Diseño:** TailwindCSS v4 (`@tailwindcss/vite`, `tailwindcss`)
* **Linter & Calidad de Código:** ESLint 10 (`eslint`)

---

## 📂 Estructura de Directorios

```text
frontend/
├── public/              # Archivos estáticos e íconos públicos
├── src/
│   ├── assets/          # Imágenes, fuentes y recursos gráficos
│   ├── components/      # Componentes UI reutilizables (Botones, Modales, Navbar)
│   ├── pages/           # Vistas / Páginas de la aplicación (Home, Login, Reservas)
│   ├── routes/          # Configuración y guardias de rutas (React Router)
│   ├── services/        # Cliente HTTP / Conexión a la API Backend
│   ├── App.tsx          # Componente principal de la aplicación
│   ├── main.tsx         # Punto de entrada de React en el DOM
│   └── index.css        # Importación de TailwindCSS y estilos globales
├── index.html           # Plantilla HTML base
├── vite.config.ts       # Configuración del bundler Vite
├── package.json         # Dependencias y scripts de ejecucion
└── tsconfig.json        # Configuración de TypeScript
```

---

## 🚀 Instalación y Ejecución

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación se abrirá por defecto en `http://localhost:5173`.

3. **Construir para producción (Build):**
   ```bash
   npm run build
   ```
   Genera la versión optimizada en la carpeta `dist/`.

4. **Vista previa de la build de producción:**
   ```bash
   npm run preview
   ```

5. **Ejecutar Linter:**
   ```bash
   npm run lint
   ```

---

## 🔗 Enlaces Relacionados
* ⬅️ **[Volver al README Principal](../README.md)**
* ⚙️ **[Backend README](../backend/README.md)**
