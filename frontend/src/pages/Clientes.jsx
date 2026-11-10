import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api/client.js";
import { FAIXA_LABEL, PERFIL_LABEL, fmt } from "../api/format.js";
import {
  BotoesRelatorio, Button, EmptyState, ErrorState, FilterBar, PageHeader, PerfilPill, RiskPill, ScoreBar, SearchInput, Select,
  SkeletonRows, Sparkline, Th, filtrarPorBusca, rotuloOrdenacao, useData, useLinhaClicavel, useOrdenacao, useOrdenacaoNaUrl,
  useParamsPersistidos,
} from "../components/ui.jsx";

const OPCOES = {
  faixa: Object.entries(FAIXA_LABEL),
  perfil: Object.entries(PERFIL_LABEL),
  porte: ["Micro", "Pequena", "Média"],
  setor: ["Comércio", "Indústria", "Serviços", "Tecnologia"],
  cidade: ["Cachoeirinha", "Canoas", "Esteio", "Gravataí", "Novo Hamburgo", "Porto Alegre"],
  servico: ["Sistema Alfa", "Sistema Beta", "Portal Web", "Aplicativo Mobile"],
};
const ROTULOS = { faixa: "Risco", perfil: "Perfil", porte: "Porte", setor: "Setor", cidade: "Cidade", servico: "Serviço" };
const CAMPOS = Object.keys(ROTULOS);
const FAIXA_PESO = { alto: 3, atencao: 2, saudavel: 1 };

const valorLegivel = (campo, v) => (campo === "faixa" ? FAIXA_LABEL[v] : campo === "perfil" ? PERFIL_LABEL[v] : v);

// Variação de acessos do primeiro ao último mês (jul → set), para ordenar a coluna de uso.
function variacaoUso(c) {
  const v = (c.uso_total ?? []).map((u) => u.acessos).filter(Number.isFinite);
  if (v.length < 2 || !v[0]) return null;
  return (v[v.length - 1] - v[0]) / v[0];
}

const COLUNAS = {
  nome: { get: (c) => c.nome },
  setor: { get: (c) => c.setor },
  cidade: { get: (c) => c.cidade },
  score: { get: (c) => c.score, primeiro: "desc" },
  faixa: { get: (c) => FAIXA_PESO[c.faixa], primeiro: "desc" },
  perfil: { get: (c) => PERFIL_LABEL[c.perfil] },
  uso: { get: variacaoUso },
  pendentes: { get: (c) => c.pendentes, primeiro: "desc" },
  nota: { get: (c) => c.satisfacao_media },
};
const NOMES_COLUNAS = { nome: "Cliente", setor: "Setor", cidade: "Cidade", score: "Score", faixa: "Faixa", perfil: "Perfil", uso: "Variação de uso", pendentes: "Pendentes", nota: "Nota" };

const CAMPOS_BUSCA = [
  (c) => c.nome, (c) => c.cliente_id, (c) => c.setor, (c) => c.cidade, (c) => c.porte,
  (c) => FAIXA_LABEL[c.faixa], (c) => PERFIL_LABEL[c.perfil], (c) => c.motivo_principal,
];

export default function Clientes() {
  const { usuario } = useAuth();
  const [params, setParams] = useParamsPersistidos("clientes");
  const linha = useLinhaClicavel();
  const busca = params.get("busca") ?? "";
  // Filtros de combobox vão para o backend; busca e ordenação são locais.
  const filtros = Object.fromEntries(CAMPOS.filter((c) => params.get(c)).map((c) => [c, params.get(c)]));
  const chave = JSON.stringify(filtros);
  const { data, error, loading, reload } = useData(() => api.clientes(filtros), [chave]);

  const encontrados = useMemo(() => filtrarPorBusca(data?.itens, busca, CAMPOS_BUSCA), [data, busca]);
  const ord = useOrdenacao(encontrados, COLUNAS, useOrdenacaoNaUrl(params, setParams));

  function atualizar(campo, valor) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      valor ? n.set(campo, valor) : n.delete(campo);
      return n;
    }, { replace: true });
  }

  function limpar() {
    setParams({}, { replace: true });
  }

  const ativos = CAMPOS.filter((c) => filtros[c]).map((c) => ({
    chave: c,
    rotulo: `${ROTULOS[c]}: ${valorLegivel(c, filtros[c])}`,
    remover: () => atualizar(c, undefined),
  }));
  const filtrando = ativos.length > 0 || busca.trim();
  const ordenacao = ord.ordem && { rotulo: rotuloOrdenacao(ord.ordem, NOMES_COLUNAS), limpar: ord.limpar };

  return (
    <>
      <PageHeader title="Clientes" meta={data ? `${data.total} clientes ordenados por prioridade de contato` : " "}>
        {usuario?.papel === "analista" && <BotoesRelatorio papel="analista" filtros={filtros} rotuloPdf="Baixar PDF" />}
      </PageHeader>

      <FilterBar
        ativos={ativos}
        ordenacao={ordenacao}
        resumo={data && filtrando ? `${encontrados.length} de ${data.total} clientes` : null}
        onLimpar={limpar}
      >
        <SearchInput
          value={busca}
          onChange={(v) => atualizar("busca", v || undefined)}
          placeholder="Nome, código, setor, cidade, perfil, motivo…"
          className="basis-full lg:basis-72"
        />
        {CAMPOS.map((c) => (
          <Select key={c} label={ROTULOS[c]} value={filtros[c]} onChange={(v) => atualizar(c, v)} options={OPCOES[c]} />
        ))}
      </FilterBar>

      <div className="overflow-x-auto rounded-panel border border-ink bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="px-5"><SkeletonRows rows={8} cols={7} /></div>
        ) : ord.ordenados.length === 0 ? (
          <EmptyState
            title={busca.trim() ? `Nenhum cliente encontrado para "${busca.trim()}"` : "Nenhum cliente com esses filtros"}
            hint="Tente outra busca ou remova algum filtro."
            action={<Button onClick={limpar}>Limpar filtros</Button>}
          />
        ) : (
          <table className={`w-full min-w-[960px] text-sm ${loading ? "opacity-60" : ""}`}>
            <thead className="border-b border-ink bg-canvas text-left text-sm text-ink-soft">
              <tr>
                <Th {...ord.th("nome")} className="py-3 pl-5 pr-3">Cliente</Th>
                <Th {...ord.th("setor")} className="px-3 py-3">Setor</Th>
                <Th {...ord.th("cidade")} className="px-3 py-3">Cidade</Th>
                <Th {...ord.th("score")} className="px-3 py-3">Score</Th>
                <Th {...ord.th("faixa")} className="px-3 py-3">Faixa</Th>
                <Th {...ord.th("perfil")} className="px-3 py-3">Perfil</Th>
                <Th {...ord.th("uso")} className="px-3 py-3">Uso jul–set</Th>
                <Th {...ord.th("pendentes")} alinhar="right" className="px-3 py-3">Pendentes</Th>
                <Th {...ord.th("nota")} alinhar="right" className="px-3 py-3">Nota</Th>
                <th className="px-5 py-3"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ord.ordenados.map((c) => (
                <tr key={c.cliente_id} {...linha(`/clientes/${c.cliente_id}`)}>
                  <td className="py-2.5 pl-5 pr-3">
                    <Link to={`/clientes/${c.cliente_id}`} className="font-semibold hover:underline">{c.nome}</Link>
                    <span className="block text-xs text-ink-soft">
                      {c.cliente_id}
                      {c.contatado_em && <span className="ml-2 font-semibold text-ink"><span className="text-risk-saudavel" aria-hidden>● </span>contatado</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{c.setor}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{c.cidade}</td>
                  <td className="px-3 py-2.5"><ScoreBar score={c.score} faixa={c.faixa} /></td>
                  <td className="px-3 py-2.5"><RiskPill faixa={c.faixa} /></td>
                  <td className="px-3 py-2.5"><PerfilPill perfil={c.perfil} /></td>
                  <td className="px-3 py-2.5"><Sparkline valores={(c.uso_total ?? []).map((u) => u.acessos)} faixa={c.faixa} /></td>
                  <td className="px-3 py-2.5 text-right">{fmt.num(c.pendentes)}</td>
                  <td className="px-3 py-2.5 text-right">{fmt.nota(c.satisfacao_media)}</td>
                  <td className="px-5 py-2.5 text-right text-lg text-ink-soft" aria-hidden>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
