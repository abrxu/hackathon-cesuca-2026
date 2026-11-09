import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { fmt } from "../api/format.js";
import { EmptyState, ErrorState, PageHeader, Select, SkeletonRows, Button, faixaClasses, useData } from "../components/ui.jsx";

const SERVICOS = ["Sistema Alfa", "Sistema Beta", "Portal Web", "Aplicativo Mobile"];
const ASSUNTOS = ["Acesso e senha", "Atualização", "Dúvida de utilização", "Erro no sistema", "Instalação", "Lentidão", "Relatório", "Solicitação de melhoria"];
const CANAIS = ["E-mail", "Portal", "Telefone", "WhatsApp"];
const SUGERIDA_CLASSES = {
  "Crítica": "bg-risk-alto text-white",
  Alta: "bg-risk-atencao-soft text-risk-atencao",
  Normal: "text-ink-soft",
};

export default function Fila() {
  const [params, setParams] = useSearchParams();
  const filtros = Object.fromEntries([...params.entries()].filter(([, v]) => v));
  const ordem = filtros.ordem ?? "inteligente";
  const { data, error, loading, reload } = useData(() => api.fila(filtros), [params.toString()]);

  function atualizar(campo, valor) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      valor ? n.set(campo, valor) : n.delete(campo);
      return n;
    }, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Fila de chamados"
        meta={data ? `${data.total} chamados pendentes, reordenados pelo risco de quem abriu` : " "}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-md border border-line bg-surface p-0.5" role="radiogroup" aria-label="Ordem da fila">
          {[["inteligente", "Ordem inteligente"], ["chegada", "Ordem de chegada"]].map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={ordem === v}
              onClick={() => atualizar("ordem", v === "inteligente" ? undefined : v)}
              className={`rounded px-3.5 py-1.5 text-sm font-semibold ${ordem === v ? "bg-brand text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <Select label="Serviço" value={filtros.servico} onChange={(v) => atualizar("servico", v)} options={SERVICOS} />
        <Select label="Assunto" value={filtros.assunto} onChange={(v) => atualizar("assunto", v)} options={ASSUNTOS} />
        <Select label="Canal" value={filtros.canal} onChange={(v) => atualizar("canal", v)} options={CANAIS} />
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="px-5"><SkeletonRows rows={8} cols={7} /></div>
        ) : data.itens.length === 0 ? (
          <EmptyState
            title="Nenhum chamado pendente com esses filtros"
            hint="Tente remover algum filtro."
            action={<Button onClick={() => setParams({}, { replace: true })}>Limpar filtros</Button>}
          />
        ) : (
          <table className={`w-full min-w-[1080px] text-sm ${loading ? "opacity-60" : ""}`}>
            <thead className="border-b border-line text-left text-xs text-ink-faint">
              <tr>
                <th className="py-3 pl-5 pr-3 font-medium">Posição</th>
                <th className="px-3 py-3 font-medium">Chamado</th>
                <th className="px-3 py-3 font-medium">Cliente</th>
                <th className="px-3 py-3 font-medium">Assunto</th>
                <th className="px-3 py-3 font-medium">Serviço</th>
                <th className="px-3 py-3 font-medium">Informada</th>
                <th className="px-3 py-3 font-medium">Sugerida</th>
                <th className="px-3 py-3 text-right font-medium">Aberto há</th>
                <th className="py-3 pl-3 pr-5 font-medium">Por que subiu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.itens.map((it) => {
                const a = it.atendimento;
                const diverge = it.prioridade_sugerida !== a.prioridade;
                return (
                  <tr key={a.atendimento_id} className="hover:bg-canvas">
                    <td className="py-2.5 pl-5 pr-3 font-semibold">{it.posicao}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.atendimento_id}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/clientes/${it.cliente.cliente_id}`} className="font-semibold hover:underline">{it.cliente.nome}</Link>
                      <span className={`ml-2 text-xs font-bold ${faixaClasses(it.cliente.faixa).text}`}>{fmt.num(it.cliente.score)}</span>
                    </td>
                    <td className="px-3 py-2.5">{a.assunto}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.servico}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.prioridade}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${diverge ? SUGERIDA_CLASSES[it.prioridade_sugerida] : "text-ink-soft"}`}>
                        {it.prioridade_sugerida}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{Number.isFinite(it.dias_aberto) ? `${it.dias_aberto} d` : fmt.dash}</td>
                    <td className="py-2.5 pl-3 pr-5 text-ink-soft">{it.motivo || fmt.dash}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
