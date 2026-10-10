import LayoutGestion from "./components/LayoutGestion";
import ProveedoresPage from "./pages/gestion/ProveedoresPage";

function App() {
  return (
    <LayoutGestion seccion="Proveedores">
      <ProveedoresPage />
    </LayoutGestion>
  );
}

export default App;
