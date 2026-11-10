import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { FAIXA_LABEL, fmt } from "../api/format.js";
import {
  Button, EmptyState, ErrorState, FilterBar, PageHeader, SearchInput, Select, SkeletonRows, Th, faixaClasses,
  filtrarPorBusca, rotuloOrdenacao, useData, useLinhaClicavel, useOrdenacao, useOrdenacaoNaUrl, useParamsPersistidos,
} from "../components/ui.jsx";

const SERVICOS = ["Sistema Alfa", "Sistema Beta", "Portal Web", "Aplicativo Mobile"];
const ASSUNTOS = ["Acesso e senha", "Atualização", "Dúvida de utilização", "Erro no sistema", "Instalação", "Lentidão", "Relatório", "Solicitação de melhoria"];
const CANAIS = ["E-mail", "Portal", "Telefone", "WhatsApp"];
const SUGERIDAS = ["Crítica", "Alta", "Normal", "Baixa"];
const SUGERIDA_CLASSES = {
  "Crítica": "border-risk-alto bg-risk-alto text-white",
  Alta: "border-risk-atencao bg-risk-atencao/15 text-ink",
  Baixa: "border-ink/15 bg-ink/5 text-ink-soft",
  Normal: "border-ink/15 bg-ink/5 text-ink-soft",
};
const PESO_PRIORIDADE = { "Crítica": 4, Alta: 3, Normal: 2, Baixa: 1 };

// Serviço, assunto e canal filtram no backend; prioridade sugerida, risco e busca filtram aqui.
const FILTROS_SERVIDOR = ["servico", "assunto", "canal"];
const ROTULOS = { servico: "Serviço", assunto: "Assunto", canal: "Canal", sugerida: "Sugerida", faixa: "Risco" };

const COLUNAS = {
  posicao: { get: (it) => it.posicao },
  chamado: { get: (it) => it.atendimento.atendimento_id },
  cliente: { get: (it) => it.cliente.nome },
  score: { get: (it) => it.cliente.score, primeiro: "desc" },
  assunto: { get: (it) => it.atendimento.assunto },
  servico: { get: (it) => it.atendimento.servico },
  canal: { get: (it) => it.atendimento.canal },
  informada: { get: (it) => PESO_PRIORIDADE[it.atendimento.prioridade], primeiro: "desc" },
  sugerida: { get: (it) => PESO_PRIORIDADE[it.prioridade_sugerida], primeiro: "desc" },
  dias: { get: (it) => it.dias_aberto, primeiro: "desc" },
  motivo: { get: (it) => it.motivo },
};
const NOMES_COLUNAS = {
  posicao: "Posição", chamado: "Chamado", cliente: "Cliente", score: "Score do cliente", assunto: "Assunto", servico: "Serviço",
  canal: "Canal", informada: "Prioridade informada", sugerida: "Prioridade sugerida", dias: "Aberto há", motivo: "Por que subiu",
};

const CAMPOS_BUSCA = [
  (it) => it.atendimento.atendimento_id, (it) => it.cliente.nome, (it) => it.cliente.cliente_id, (it) => it.atendimento.assunto,
  (it) => it.atendimento.servico, (it) => it.atendimento.canal, (it) => it.atendimento.prioridade, (it) => it.prioridade_sugerida,
  (it) => it.motivo, (it) => FAIXA_LABEL[it.cliente.faixa],
];

export default function Fila() {
  const [params, setParams] = useParamsPersistidos("fila");
  const linha = useLinhaClicavel();
  const ordem = params.get("ordem") ?? "inteligente";
  const busca = params.get("busca") ?? "";
  const sugerida = params.get("sugerida") ?? undefined;
  const faixa = params.get("faixa") ?? undefined;
  const filtros = Object.fromEntries(FILTROS_SERVIDOR.filter((c) => params.get(c)).map((c) => [c, params.get(c)]));
  const chaveServidor = JSON.stringify({ ...filtros, ordem });
  const { data, error, loading, reload } = useData(() => api.fila({ ...filtros, ordem: ordem === "inteligente" ? undefined : ordem }), [chaveServidor]);

  const encontrados = useMemo(() => {
    const porCampos = (data?.itens ?? []).filter(
      (it) => (!sugerida || it.prioridade_sugerida === sugerida) && (!faixa || it.cliente.faixa === faixa),
    );
    return filtrarPorBusca(porCampos, busca, CAMPOS_BUSCA);
  }, [data, busca, sugerida, faixa]);
  const ord = useOrdenacao(encontrados, COLUNAS, useOrdenacaoNaUrl(params, setParams));

  function atualizar(campo, valor) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      valor ? n.set(campo, valor) : n.delete(campo);
      return n;
    }, { replace: true });
  }

  function limpar() {
    setParams(ordem === "inteligente" ? {} : { ordem }, { replace: true });
  }

  const valores = { ...filtros, sugerida, faixa };
  const ativos = Object.keys(ROTULOS).filter((c) => valores[c]).map((c) => ({
    chave: c,
    rotulo: `${ROTULOS[c]}: ${c === "faixa" ? FAIXA_LABEL[valores[c]] : valores[c]}`,
    remover: () => atualizar(c, undefined),
  }));
  const filtrando = ativos.length > 0 || busca.trim();
  const ordenacao = ord.ordem && { rotulo: rotuloOrdenacao(ord.ordem, NOMES_COLUNAS), limpar: ord.limpar };

  return (
    <>
      <PageHeader
        title="Fila de chamados"
        meta={data ? `${data.total} chamados pendentes, ${ordem === "inteligente" ? "reordenados pelo risco de quem abriu" : "na ordem em que chegaram"}` : " "}
      >
        <div className="inline-flex rounded-control border border-ink bg-surface p-0.5" role="radiogroup" aria-label="Ordem da fila">
          {[["inteligente", "Ordem inteligente"], ["chegada", "Ordem de chegada"]].map(([v, l]) => {
            const marcado = ordem === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={marcado}
                onClick={() => atualizar("ordem", v === "inteligente" ? undefined : v)}
                className={`min-h-9 rounded-[0.375rem] px-3.5 py-1.5 text-sm font-bold ${marcado ? "bg-ink text-canvas" : "text-ink hover:underline"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <FilterBar
        ativos={ativos}
        ordenacao={ordenacao}
        resumo={data && filtrando ? `${encontrados.length} de ${data.total} chamados` : null}
        onLimpar={limpar}
      >
        <SearchInput
          value={busca}
          onChange={(v) => atualizar("busca", v || undefined)}
          placeholder="Chamado, cliente, assunto, canal, motivo…"
          className="basis-full lg:basis-72"
        />
        <Select label="Serviço" value={filtros.servico} onChange={(v) => atualizar("servico", v)} options={SERVICOS} />
        <Select label="Assunto" value={filtros.assunto} onChange={(v) => atualizar("assunto", v)} options={ASSUNTOS} />
        <Select label="Canal" value={filtros.canal} onChange={(v) => atualizar("canal", v)} options={CANAIS} />
        <Select label="Sugerida" value={sugerida} onChange={(v) => atualizar("sugerida", v)} options={SUGERIDAS} />
        <Select label="Risco" value={faixa} onChange={(v) => atualizar("faixa", v)} options={Object.entries(FAIXA_LABEL)} />
      </FilterBar>

      <div className="overflow-x-auto rounded-panel border border-ink bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="px-5"><SkeletonRows rows={8} cols={7} /></div>
        ) : ord.ordenados.length === 0 ? (
          <EmptyState
            title={busca.trim() ? `Nenhum chamado encontrado para "${busca.trim()}"` : "Nenhum chamado pendente com esses filtros"}
            hint="Tente outra busca ou remova algum filtro."
            action={<Button onClick={limpar}>Limpar filtros</Button>}
          />
        ) : (
          <table className={`w-full min-w-[1180px] text-sm ${loading ? "opacity-60" : ""}`}>
            <thead className="border-b border-ink bg-canvas text-left text-sm text-ink-soft">
              <tr>
                <Th {...ord.th("posicao")} className="py-3 pl-5 pr-3">Posição</Th>
                <Th {...ord.th("chamado")} className="px-3 py-3">Chamado</Th>
                <Th {...ord.th("cliente")} className="px-3 py-3">Cliente</Th>
                <Th {...ord.th("score")} alinhar="right" className="px-3 py-3">Score</Th>
                <Th {...ord.th("assunto")} className="px-3 py-3">Assunto</Th>
                <Th {...ord.th("servico")} className="px-3 py-3">Serviço</Th>
                <Th {...ord.th("canal")} className="px-3 py-3">Canal</Th>
                <Th {...ord.th("informada")} className="px-3 py-3">Informada</Th>
                <Th {...ord.th("sugerida")} className="px-3 py-3">Sugerida</Th>
                <Th {...ord.th("dias")} alinhar="right" className="px-3 py-3">Aberto há</Th>
                <Th {...ord.th("motivo")} className="py-3 pl-3 pr-5">Por que subiu</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ord.ordenados.map((it) => {
                const a = it.atendimento;
                const c = faixaClasses(it.cliente.faixa);
                return (
                  <tr key={a.atendimento_id} {...linha(`/clientes/${it.cliente.cliente_id}`)}>
                    <td className="py-2.5 pl-5 pr-3 font-semibold">{it.posicao}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.atendimento_id}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/clientes/${it.cliente.cliente_id}`} className="font-semibold whitespace-nowrap hover:underline">{it.cliente.nome}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`rounded-full border px-1.5 py-px text-xs font-bold ${c.pill}`} title={FAIXA_LABEL[it.cliente.faixa]}>{fmt.num(it.cliente.score)}</span>
                    </td>
                    <td className="px-3 py-2.5">{a.assunto}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.servico}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.canal || fmt.dash}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{a.prioridade}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-bold ${SUGERIDA_CLASSES[it.prioridade_sugerida] ?? SUGERIDA_CLASSES.Normal}`}>
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
