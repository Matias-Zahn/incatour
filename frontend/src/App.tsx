import LayoutGestion from "./components/LayoutGestion";
import InicioGestionPage from "./pages/gestion/InicioGestionPage";
import ProveedoresPage from "./pages/gestion/ProveedoresPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <LayoutGestion seccion="Inicio">
              <InicioGestionPage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
