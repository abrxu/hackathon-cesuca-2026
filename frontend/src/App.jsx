import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Painel from "./pages/Painel.jsx";
import Clientes from "./pages/Clientes.jsx";
import Cliente360 from "./pages/Cliente360.jsx";
import Fila from "./pages/Fila.jsx";

function Protegido({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protegido><Layout /></Protegido>}>
            <Route index element={<Painel />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<Cliente360 />} />
            <Route path="chamados" element={<Fila />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
