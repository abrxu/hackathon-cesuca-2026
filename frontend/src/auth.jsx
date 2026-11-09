import { createContext, useContext, useState } from "react";
import { api } from "./api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => api.usuarioSalvo());
  const value = {
    usuario,
    async entrar(email, senha) {
      setUsuario(await api.login(email, senha));
    },
    sair() {
      api.logout();
      setUsuario(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
