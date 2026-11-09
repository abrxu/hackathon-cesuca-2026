import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { FORMATO_LABEL, fmt } from "../api/format.js";
import { AiBlock, Button, Skeleton } from "./ui.jsx";

const FORMATOS = ["ligacao", "email", "whatsapp"];

// Tela 04: painel lateral sobre o Cliente 360.
export default function AcaoSugerida({ cliente, contatadoEm, onContatado, onClose }) {
  const [formato, setFormato] = useState("ligacao");
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState({ loading: true, data: null, error: null });
  const [copiado, setCopiado] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [erroContato, setErroContato] = useState(null);
  const fecharRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    setEstado({ loading: true, data: null, error: null });
    api.acao(cliente.cliente_id, formato)
      .then((data) => vivo && setEstado({ loading: false, data, error: null }))
      .catch((error) => vivo && setEstado({ loading: false, data: null, error }));
    return () => { vivo = false; };
  }, [cliente.cliente_id, formato, tentativa]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    fecharRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function copiar() {
    const d = estado.data;
    if (!d) return;
    const texto = [
      `Resumo: ${d.resumo}`,
      `Próximo passo: ${d.proximo_passo}`,
      "Roteiro:",
      ...(d.roteiro ?? []).map((l, i) => `${i + 1}. ${l}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  async function marcarContatado() {
    setMarcando(true);
    try {
      const r = await api.contato(cliente.cliente_id);
      setErroContato(null);
      onContatado(r.contatado_em);
    } catch (err) {
      setErroContato(err.message || "Não foi possível marcar o contato. Tente de novo.");
    } finally {
      setMarcando(false);
    }
  }

  const d = estado.data;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="acao-titulo">
      <button type="button" className="absolute inset-0 bg-ink/30" aria-label="Fechar" tabIndex={-1} onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col bg-surface shadow-2xl motion-safe:animate-[entrar_200ms_ease-out]">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <h2 id="acao-titulo" className="text-lg font-bold">
            <span className="text-ai" aria-hidden>✦ </span>
            Ação sugerida para {cliente.nome}
          </h2>
          <button ref={fecharRef} type="button" onClick={onClose} className="rounded-md px-2 py-1 text-ink-faint hover:text-ink" aria-label="Fechar painel">
            ✕
          </button>
        </header>

        <div className="flex gap-1 border-b border-line px-6" role="tablist" aria-label="Formato">
          {FORMATOS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={formato === f}
              onClick={() => setFormato(f)}
              className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold ${formato === f ? "border-ai text-ai" : "border-transparent text-ink-soft hover:text-ink"}`}
            >
              {FORMATO_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {estado.loading ? (
            <div aria-busy="true">
              <p className="mb-4 text-sm text-ink-soft">Lendo histórico do cliente…</p>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : estado.error ? (
            <div className="py-8 text-center">
              <p className="font-semibold">{estado.error.message || "Não foi possível gerar a ação sugerida."}</p>
              <Button className="mt-4" onClick={() => setTentativa((t) => t + 1)}>Gerar de novo</Button>
            </div>
          ) : (
            <AiBlock fonte={d.fonte}>
              <div className="space-y-4 text-[15px] leading-relaxed">
                <p><span className="font-semibold">Resumo: </span>{d.resumo || fmt.dash}</p>
                <p><span className="font-semibold">Próximo passo: </span>{d.proximo_passo || fmt.dash}</p>
                <div>
                  <p className="font-semibold">Roteiro:</p>
                  <ol className="mt-1 list-decimal space-y-1.5 pl-5">
                    {(d.roteiro ?? []).map((l, i) => <li key={i}>{l}</li>)}
                  </ol>
                </div>
              </div>
            </AiBlock>
          )}
          {d?.baseado_em && (
            <p className="mt-4 text-xs text-ink-faint">
              Baseado em {fmt.num(d.baseado_em.atendimentos)} chamados, {fmt.num(d.baseado_em.meses_de_uso)} meses de uso e cadastro do cliente.
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
          <Button variant="primary" onClick={copiar} disabled={!d}>{copiado ? "Roteiro copiado" : "Copiar roteiro"}</Button>
          <Button onClick={() => setTentativa((t) => t + 1)} disabled={estado.loading}>Gerar de novo</Button>
          <span className="ml-auto">
            {contatadoEm ? (
              <span className="text-sm font-semibold text-risk-saudavel">Contatado em {fmt.data(contatadoEm)}</span>
            ) : (
              <Button variant="ghost" onClick={marcarContatado} disabled={marcando}>
                {marcando ? "Marcando…" : "Marcar como contatado"}
              </Button>
            )}
          </span>
          {erroContato && <p className="w-full text-sm text-risk-alto" role="alert">{erroContato}</p>}
        </footer>
      </aside>
    </div>
  );
}
