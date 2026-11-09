import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api/client.js";
import { FAIXA_LABEL, PERFIL_LABEL, fmt } from "../api/format.js";
import {
  BotoesRelatorio, Button, Chip, EmptyState, ErrorState, PageHeader, PerfilPill, RiskPill, ScoreBar, Select, SkeletonRows, Sparkline, useData,
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

const valorLegivel = (campo, v) => (campo === "faixa" ? FAIXA_LABEL[v] : campo === "perfil" ? PERFIL_LABEL[v] : v);

export default function Clientes() {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const filtros = Object.fromEntries([...params.entries()].filter(([, v]) => v));
  const chave = params.toString();
  const [busca, setBusca] = useState(filtros.busca ?? "");

  // Busca aplica após uma pausa curta na digitação.
  useEffect(() => {
    const t = setTimeout(() => atualizar("busca", busca.trim() || undefined), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const { data, error, loading, reload } = useData(() => api.clientes(filtros), [chave]);

  function atualizar(campo, valor) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      valor ? n.set(campo, valor) : n.delete(campo);
      return n;
    }, { replace: true });
  }

  function ordenarPor(campo) {
    const atual = filtros.ordenar ?? "prioridade";
    const dir = atual === campo && (filtros.direcao ?? "desc") === "desc" ? "asc" : "desc";
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("ordenar", campo);
      n.set("direcao", dir);
      return n;
    }, { replace: true });
  }

  function limpar() {
    setBusca("");
    setParams({}, { replace: true });
  }

  const ativos = CAMPOS.filter((c) => filtros[c]);

  return (
    <>
      <PageHeader title="Clientes" meta={data ? `${data.total} clientes ordenados por prioridade de contato` : " "}>
        {usuario?.papel === "analista" && <BotoesRelatorio papel="analista" filtros={filtros} rotuloPdf="Baixar PDF" />}
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-semibold text-ink">
          Buscar
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome do cliente ou código (C037)"
            className="h-10 rounded-control border border-ink bg-surface px-3 text-sm font-normal text-ink"
          />
        </label>
        {CAMPOS.map((c) => (
          <Select key={c} label={ROTULOS[c]} value={filtros[c]} onChange={(v) => atualizar(c, v)} options={OPCOES[c]} />
        ))}
      </div>

      <div className="mb-4 flex min-h-7 flex-wrap items-center gap-2 text-sm">
        {ativos.map((c) => (
          <Chip key={c} onRemove={() => atualizar(c, undefined)}>
            {ROTULOS[c]}: {valorLegivel(c, filtros[c])}
          </Chip>
        ))}
        {ativos.length > 0 && data && <span className="text-ink-soft">{data.total} resultados</span>}
      </div>

      <div className="overflow-x-auto rounded-panel border border-ink bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <div className="px-5"><SkeletonRows rows={8} cols={7} /></div>
        ) : data.itens.length === 0 ? (
          <EmptyState
            title="Nenhum cliente com esses filtros"
            hint="Tente remover algum filtro."
            action={<Button onClick={limpar}>Limpar filtros</Button>}
          />
        ) : (
          <table className={`w-full min-w-[960px] text-sm ${loading ? "opacity-60" : ""}`}>
            <thead className="border-b border-ink bg-canvas text-left text-sm text-ink-soft">
              <tr>
                <Th onClick={() => ordenarPor("nome")} ativo={filtros.ordenar === "nome"} dir={filtros.direcao}>Cliente</Th>
                <th className="px-3 py-3 font-semibold">Setor</th>
                <th className="px-3 py-3 font-semibold">Cidade</th>
                <Th onClick={() => ordenarPor("score")} ativo={!filtros.ordenar || filtros.ordenar === "score" || filtros.ordenar === "prioridade"} dir={filtros.direcao}>Score</Th>
                <th className="px-3 py-3 font-semibold">Faixa</th>
                <th className="px-3 py-3 font-semibold">Perfil</th>
                <th className="px-3 py-3 font-semibold">Uso jul–set</th>
                <th className="px-3 py-3 text-right font-semibold">Pendentes</th>
                <th className="px-3 py-3 text-right font-semibold">Nota</th>
                <th className="px-5 py-3"><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.itens.map((c) => (
                <tr key={c.cliente_id} className="hover:bg-brand-soft">
                  <td className="px-5 py-2.5">
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
                  <td className="px-5 py-2.5 text-right">
                    <Link to={`/clientes/${c.cliente_id}`} className="text-sm font-semibold text-ink underline underline-offset-4 hover:no-underline">Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children, onClick, ativo, dir }) {
  return (
    <th className="px-3 py-3 font-semibold first:px-5" aria-sort={ativo ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-ink ${ativo ? "text-ink" : ""}`}>
        {children}
        {ativo && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
