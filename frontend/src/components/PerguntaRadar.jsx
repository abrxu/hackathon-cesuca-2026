import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { Button, Section } from "./ui.jsx";

export default function PerguntaRadar() {
  const [pergunta, setPergunta] = useState("");
  const [estado, setEstado] = useState({ loading: false, data: null, error: null });

  async function enviar(e) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto) return;
    setEstado({ loading: true, data: null, error: null });
    try {
      setEstado({ loading: false, data: await api.perguntar(texto), error: null });
    } catch (error) {
      setEstado({ loading: false, data: null, error });
    }
  }

  const { loading, data, error } = estado;
  return (
    <Section title="Pergunte ao Radar">
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <textarea
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          rows={3}
          placeholder="Ex.: Quais clientes de comércio estão frustrados?"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          aria-label="Pergunta"
        />
        <div>
          <Button variant="ai" type="submit" disabled={loading || !pergunta.trim()}>
            {loading ? "Consultando…" : "Perguntar"}
          </Button>
        </div>
      </form>

      {loading && <p className="mt-4 text-sm text-ink-soft" aria-busy="true">Consultando a carteira…</p>}
      {error && <p className="mt-4 text-sm text-risk-alto" role="alert">{error.message || "Não foi possível consultar a carteira."}</p>}
      {data && (
        <div className="mt-4">
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{data.resposta || ""}</p>
          {(data.clientes ?? []).length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {data.clientes.map((c) => (
                <li key={c.cliente_id}>
                  <Link to={`/clientes/${c.cliente_id}`} className="rounded-full border border-line px-3 py-1 text-sm font-medium text-brand hover:underline">
                    {c.nome} ({c.cliente_id})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
