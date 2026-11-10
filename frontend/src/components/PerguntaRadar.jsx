import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown.jsx";
import { api } from "../api/client.js";

const NOME = "Eco";
const SUGESTOES = [
  "Quais clientes de comércio estão frustrados?",
  "Quem está silencioso há mais tempo?",
  "Quais clientes grandes têm risco alto?",
];

export function EcoIcon({ size = 28, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="currentColor" />
      <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.55">
        <path d="M9 20a11 11 0 0 1 11-11" />
        <path d="M31 20a11 11 0 0 1-11 11" />
      </g>
      <path d="M20 12.5c.9 4.1 3.4 6.6 7.5 7.5-4.1.9-6.6 3.4-7.5 7.5-.9-4.1-3.4-6.6-7.5-7.5 4.1-.9 6.6-3.4 7.5-7.5Z" fill="#fff" />
    </svg>
  );
}

export default function PerguntaRadar() {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const fimRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => { if (aberto) inputRef.current?.focus(); }, [aberto]);

  async function enviar(texto) {
    texto = (texto ?? pergunta).trim();
    if (!texto || loading) return;
    setPergunta("");
    setMsgs((m) => [...m, { de: "user", texto }]);
    setLoading(true);
    try {
      const data = await api.perguntar(texto);
      setMsgs((m) => [...m, { de: "eco", texto: data?.resposta || "Não encontrei nada para essa pergunta.", clientes: data?.clientes ?? [] }]);
    } catch (error) {
      setMsgs((m) => [...m, { de: "eco", erro: true, texto: error?.message || "Não foi possível consultar a carteira agora." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-ai py-2 pl-2 pr-5 font-bold text-white shadow-lg transition hover:scale-105"
        aria-label={`Abrir ${NOME}, assistente do Radar`}
      >
        <EcoIcon size={36} className="text-white/20" />
        Pergunte ao {NOME}
      </button>
    );
  }

  const tamanho = expandido
    ? "inset-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(85vh,820px)] sm:w-[min(720px,calc(100vw-3rem))]"
    : "inset-x-4 bottom-4 h-[70vh] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[460px]";

  return (
    <div role="dialog" aria-label={`${NOME}, assistente do Radar`} className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-canvas shadow-2xl ${tamanho}`}>
      <header className="flex items-center gap-3 bg-ai px-4 py-3 text-white">
        <EcoIcon size={36} className="text-white/20" />
        <div className="leading-tight">
          <p className="font-extrabold">{NOME}</p>
          <p className="text-xs text-white/80">Assistente da carteira</p>
        </div>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setExpandido((v) => !v)} className="rounded-md p-1.5 hover:bg-white/15" aria-label={expandido ? "Reduzir" : "Expandir"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {expandido ? <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /> : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}
            </svg>
          </button>
          <button type="button" onClick={() => setAberto(false)} className="rounded-md p-1.5 hover:bg-white/15" aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-ai-soft px-4 py-4">
        <Balao de="eco">
          Olá! Sou o {NOME}. Pergunte sobre a sua carteira de clientes.
        </Balao>
        {msgs.length === 0 && (
          <div className="flex flex-col items-start gap-2 pl-9">
            {SUGESTOES.map((s) => (
              <button key={s} type="button" onClick={() => enviar(s)} className="rounded-full border border-ai/40 bg-canvas px-3 py-1 text-left text-sm text-ai hover:bg-ai hover:text-white">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <Balao key={i} de={m.de} erro={m.erro}>
            {m.de === "eco" && !m.erro ? <Markdown>{m.texto}</Markdown> : <p className="whitespace-pre-line">{m.texto}</p>}
          </Balao>
        ))}
        {loading && (
          <Balao de="eco">
            <span className="inline-flex gap-1" aria-busy="true" aria-label="Consultando">
              {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-ai/60" style={{ animationDelay: `${d}ms` }} />)}
            </span>
          </Balao>
        )}
        <div ref={fimRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2 border-t border-ink/10 bg-canvas p-3">
        <textarea
          ref={inputRef}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          rows={1}
          placeholder={`Pergunte ao ${NOME}…`}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-ink/20 bg-canvas px-3 py-2 text-sm text-ink focus:border-ai focus:outline-none"
          aria-label="Pergunta"
        />
        <button type="submit" disabled={loading || !pergunta.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-ai text-white disabled:opacity-40" aria-label="Enviar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 20.5 21 12 3 3.5l2.5 8.5L3 20.5Zm2.5-8.5H13" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </form>
    </div>
  );
}

function Balao({ de, erro, children }) {
  const eco = de === "eco";
  return (
    <div className={`flex items-end gap-2 ${eco ? "" : "justify-end"}`}>
      {eco && <EcoIcon size={28} className="shrink-0 text-ai" />}
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${eco ? "min-w-0 flex-1 " : ""}${eco ? (erro ? "rounded-bl-sm bg-canvas text-risk-alto" : "rounded-bl-sm bg-canvas text-ink shadow-sm") : "rounded-br-sm bg-ai text-white"}`}>
        {children}
      </div>
    </div>
  );
}
