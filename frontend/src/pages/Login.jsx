import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Button } from "../components/ui.jsx";

export default function Login() {
  const { usuario, entrar } = useAuth();
  const [email, setEmail] = useState("analista@radar.local");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro(err.message || "E-mail ou senha incorretos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-brand px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl bg-surface p-8">
        <p className="font-display text-5xl text-brand">Radar</p>
        <p className="mt-3 text-sm text-ink-soft">Entre para ver quem precisa de contato hoje.</p>
        <label className="mt-8 block text-sm font-medium">
          E-mail
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-line px-3 text-base font-normal"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Senha
          <input
            type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-line px-3 text-base font-normal"
          />
        </label>
        {erro && <p className="mt-4 text-sm text-risk-alto" role="alert">{erro}</p>}
        <Button variant="primary" type="submit" disabled={enviando} className="mt-6 w-full">
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
