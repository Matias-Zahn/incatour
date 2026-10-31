import { lazy, Suspense } from "react";
import LayoutCliente from "./components/LayoutCliente";
import LayoutGestion from "./components/LayoutGestion";
import Login from "./pages/Login";
import RutaProtegida from "./components/RutaProtegida";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import EstadoListado from "./components/EstadoListado";
import LimiteDeError from "./components/LimiteDeError";

// Cada pantalla se baja recién cuando se entra: un cliente no descarga el panel de gestión ni el portal del guía
const CatalogoCompraPage = lazy(() => import("./pages/cliente/CatalogoCompraPage"));
const MiCuentaClientePage = lazy(() => import("./pages/cliente/MiCuentaClientePage"));
const MisReseniasPage = lazy(() => import("./pages/cliente/MisReseniasPage"));
const MisReservasPage = lazy(() => import("./pages/cliente/MisReservasPage"));
const RegistroClientePage = lazy(() => import("./pages/cliente/RegistroClientePage"));
const CircuitosPage = lazy(() => import("./pages/gestion/CircuitosPage"));
const CuentasGuiaPage = lazy(() => import("./pages/gestion/CuentasGuiaPage"));
const EtapasPage = lazy(() => import("./pages/gestion/EtapasPage"));
const EvaluacionesPage = lazy(() => import("./pages/gestion/EvaluacionesPage"));
const InicioGestionPage = lazy(() => import("./pages/gestion/InicioGestionPage"));
const PaquetesPage = lazy(() => import("./pages/gestion/PaquetesPage"));
const PersonalPage = lazy(() => import("./pages/gestion/PersonalPage"));
const ProveedoresPage = lazy(() => import("./pages/gestion/ProveedoresPage"));
const ReportesPage = lazy(() => import("./pages/gestion/ReportesPage"));
const ReservasGestionPage = lazy(() => import("./pages/gestion/ReservasGestionPage"));
const SalidasPage = lazy(() => import("./pages/gestion/SalidasPage"));
const ServiciosPage = lazy(() => import("./pages/gestion/ServiciosPage"));
const SolicitudesPage = lazy(() => import("./pages/gestion/SolicitudesPage"));
const TemporadasPage = lazy(() => import("./pages/gestion/TemporadasPage"));
const PortalGuiaPage = lazy(() => import("./pages/guia/PortalGuiaPage"));

function App() {
  return (
    <BrowserRouter>
      <LimiteDeError>
      <Suspense fallback={<EstadoListado estado="cargando" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/registro"
          element={
            <LayoutCliente>
              <RegistroClientePage />
            </LayoutCliente>
          }
        />
        <Route
          path="/cliente/registro"
          element={
            <LayoutCliente>
              <RegistroClientePage />
            </LayoutCliente>
          }
        />
        <Route
          path="/catalogo"
          element={
            <LayoutCliente>
              <CatalogoCompraPage />
            </LayoutCliente>
          }
        />

        {/* Rutas exclusivas del perfil CLIENTE (CU-28, CU-29, CU-31, CU-32, CU-47) */}
        <Route element={<RutaProtegida roles={["CLIENTE"]} />}>
          <Route
            path="/mis-reservas"
            element={
              <LayoutCliente>
                <MisReservasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/cliente/reservas"
            element={
              <LayoutCliente>
                <MisReservasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/mis-resenias"
            element={
              <LayoutCliente>
                <MisReseniasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/cliente/resenias"
            element={
              <LayoutCliente>
                <MisReseniasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/mi-cuenta"
            element={
              <LayoutCliente>
                <MiCuentaClientePage />
              </LayoutCliente>
            }
          />
          <Route
            path="/cliente/cuenta"
            element={
              <LayoutCliente>
                <MiCuentaClientePage />
              </LayoutCliente>
            }
          />
        </Route>

        {/* Rutas exclusivas del perfil GUÍA (CU-48, CU-49, CU-50) */}
        <Route element={<RutaProtegida roles={["GUIA"]} />}>
          <Route path="/guia" element={<PortalGuiaPage />} />
          <Route path="/guia/:seccion" element={<PortalGuiaPage />} />
        </Route>

        {/* Rutas exclusivas del perfil ADMIN */}
        <Route element={<RutaProtegida roles={["ADMIN"]} />}>
          <Route
            path="/"
            element={
              <LayoutGestion seccion="Inicio">
                <InicioGestionPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/circuitos"
            element={
              <LayoutGestion seccion="Circuitos">
                <CircuitosPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/circuitos/:idCircuito/etapas"
            element={
              <LayoutGestion seccion="Circuitos">
                <EtapasPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/temporadas"
            element={
              <LayoutGestion seccion="Circuitos">
                <TemporadasPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/paquetes"
            element={
              <LayoutGestion seccion="Paquetes turísticos">
                <PaquetesPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/proveedores"
            element={
              <LayoutGestion seccion="Proveedores">
                <ProveedoresPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/proveedores/:idProveedor/servicios"
            element={
              <LayoutGestion seccion="Proveedores">
                <ServiciosPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/salidas"
            element={
              <LayoutGestion seccion="Salidas">
                <SalidasPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/solicitudes"
            element={
              <LayoutGestion seccion="Solicitudes de alojamiento">
                <SolicitudesPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/reservas"
            element={
              <LayoutGestion seccion="Reservas y pagos">
                <ReservasGestionPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/reportes"
            element={
              <LayoutGestion seccion="Reportes">
                <ReportesPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/personal"
            element={
              <LayoutGestion seccion="Personal">
                <PersonalPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/cuentas-guia"
            element={
              <LayoutGestion seccion="Personal">
                <CuentasGuiaPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/evaluaciones"
            element={
              <LayoutGestion seccion="Reseñas y evaluaciones">
                <EvaluacionesPage />
              </LayoutGestion>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </LimiteDeError>
    </BrowserRouter>
  );
}

export default App;
