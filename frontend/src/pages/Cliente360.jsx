import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { PERFIL_LABEL, fmt } from "../api/format.js";
import { Button, ErrorState, RiskPill, Section, Skeleton, SkeletonRows, faixaClasses, useData } from "../components/ui.jsx";
import AcaoSugerida from "../components/AcaoSugerida.jsx";

const FACETAS = [
  ["engajamento", "Engajamento"],
  ["atrito", "Atrito no atendimento"],
  ["satisfacao", "Satisfação"],
];

const SINAL_LABEL = (s) =>
  s === "cliente_recente" ? "Cliente recente" : s.startsWith("assunto_recorrente:") ? `Assunto recorrente: ${s.split(":")[1]}` : s;

export default function Cliente360() {
  const { id } = useParams();
  const { data, error, loading, reload, setData } = useData(() => api.cliente(id), [id]);
  const [acaoAberta, setAcaoAberta] = useState(false);

  if (error) {
    return (
      <>
        <Voltar />
        <ErrorState error={error} onRetry={error.codigo === "nao_encontrado" ? undefined : reload} />
      </>
    );
  }

  return (
    <>
      <Voltar />
      <Cabecalho data={data} loading={loading} onAcao={() => setAcaoAberta(true)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Explicacao data={data} loading={loading} />
        <UsoMensal uso={data?.uso} faixa={data?.faixa} loading={loading} />
        <Historico atendimentos={data?.atendimentos} loading={loading} />
      </div>

      {acaoAberta && data && (
        <AcaoSugerida
          cliente={data.cliente}
          contatadoEm={data.contatado_em}
          onContatado={(contatado_em) => setData({ ...data, contatado_em })}
          onClose={() => setAcaoAberta(false)}
        />
      )}
    </>
  );
}

function Voltar() {
  return (
    <Link to="/clientes" className="mb-4 inline-block text-sm text-ink-soft hover:text-ink">
      ← Voltar para a lista
    </Link>
  );
}

function Cabecalho({ data, loading, onAcao }) {
  if (loading || !data) {
    return (
      <div className="flex justify-between rounded-lg bg-surface p-6">
        <div className="space-y-3"><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-96" /></div>
        <Skeleton className="h-20 w-40" />
      </div>
    );
  }
  const c = data.cliente;
  const cor = faixaClasses(data.faixa);
  return (
    <header className="flex flex-wrap items-center gap-x-10 gap-y-6 rounded-lg bg-surface p-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight">{c.nome}</h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
          <Dado k="Código" v={c.cliente_id} />
          <Dado k="Setor" v={c.setor} />
          <Dado k="Porte" v={c.porte} />
          <Dado k="Cidade" v={c.cidade} />
          <Dado k="Cliente desde" v={fmt.mesAno(c.data_cadastro)} />
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.perfil && (
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">Perfil {PERFIL_LABEL[data.perfil]}</span>
          )}
          {(data.contexto?.sinais ?? []).map((s) => (
            <span key={s} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft">{SINAL_LABEL(s)}</span>
          ))}
          {data.contatado_em && (
            <span className="rounded-full bg-risk-saudavel-soft px-2.5 py-0.5 text-xs font-semibold text-risk-saudavel">
              Contatado em {fmt.data(data.contatado_em)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className={`font-display text-[88px] ${cor.text}`} aria-label={`Score ${data.score}`}>{fmt.num(data.score)}</p>
          <div className="mt-2"><RiskPill faixa={data.faixa} /></div>
        </div>
      </div>

      <Button variant="ai" onClick={onAcao} className="px-5 py-3 text-base">Gerar ação sugerida</Button>
    </header>
  );
}

function Dado({ k, v }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="text-ink">{v || fmt.dash}</dd>
    </div>
  );
}

function Explicacao({ data, loading }) {
  return (
    <Section title={data ? `Por que o score é ${data.score}` : "Por que o score"}>
      {loading || !data ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {FACETAS.map(([k, label]) => {
              const f = data.facetas?.[k];
              if (!f) return null;
              const max = Math.round((f.peso ?? 0) * 100);
              return (
                <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3">
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-ink-soft">{f.descricao || fmt.dash}</p>
                  </div>
                  <p className="text-right text-lg font-bold">+{fmt.num(f.contribuicao)}</p>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden>
                      <span className={`block h-full ${faixaClasses(data.faixa).bg}`} style={{ width: `${max ? (f.contribuicao / max) * 100 : 0}%` }} />
                    </span>
                    <span className="w-16 text-right text-xs text-ink-faint">de {max} pts</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex justify-between border-t-2 border-ink pt-3 font-semibold">
            <span>Score</span>
            <span>{fmt.num(data.score)}</span>
          </p>
        </>
      )}
    </Section>
  );
}

function UsoMensal({ uso, faixa, loading }) {
  const itens = uso ?? [];
  const max = Math.max(1, ...itens.map((u) => u.operacoes ?? 0));
  const cor = faixaClasses(faixa);
  return (
    <Section title="Uso mensal" aside={<span className="text-xs text-ink-faint">operações e acessos por mês</span>}>
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : itens.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">Nenhum uso registrado no período.</p>
      ) : (
        <div className="flex h-56 items-end gap-6 pt-2">
          {itens.map((u, i) => {
            const ultimo = i === itens.length - 1;
            return (
              <div key={u.mes} className="flex h-full flex-1 flex-col justify-end">
                <p className={`text-sm font-semibold ${ultimo ? cor.text : ""}`}>{fmt.num(u.operacoes)}</p>
                <p className="mb-1 text-xs text-ink-faint">{fmt.num(u.acessos)} acessos</p>
                <div
                  className={`rounded-t ${ultimo ? cor.bg : "bg-brand/30"}`}
                  style={{ height: `${Math.max(4, ((u.operacoes ?? 0) / max) * 100)}%` }}
                  aria-hidden
                />
                <p className="mt-2 text-sm font-medium">{fmt.mes(u.mes)}</p>
                <p className="truncate text-xs text-ink-faint">{u.servico}</p>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Historico({ atendimentos, loading }) {
  const itens = atendimentos ?? [];
  return (
    <Section title="Histórico de chamados" className="lg:col-span-2">
      {loading ? (
        <SkeletonRows rows={4} cols={6} />
      ) : itens.length === 0 ? (
        <p className="py-6 text-sm text-ink-soft">Este cliente não abriu chamados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-ink-faint">
              <tr>
                {["Data", "Chamado", "Assunto", "Serviço", "Canal", "Prioridade", "Status", "Tempo", "Nota"].map((h) => (
                  <th key={h} className={`pb-2 pr-4 font-medium ${["Tempo", "Nota"].includes(h) ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {itens.map((a) => {
                const pendente = a.status === "Pendente";
                return (
                  <tr key={a.atendimento_id} className={pendente ? "bg-risk-atencao-soft/60" : ""}>
                    <td className="py-2.5 pr-4">{fmt.data(a.data_abertura)}</td>
                    <td className="py-2.5 pr-4 text-ink-faint">{a.atendimento_id}</td>
                    <td className="py-2.5 pr-4 font-medium">{a.assunto}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{a.servico}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{a.canal}</td>
                    <td className={`py-2.5 pr-4 ${a.prioridade === "Alta" ? "font-semibold" : ""}`}>{a.prioridade}</td>
                    <td className={`py-2.5 pr-4 ${pendente ? "font-semibold text-risk-atencao" : "text-ink-soft"}`}>{a.status}</td>
                    <td className="py-2.5 pr-4 text-right">{fmt.minutos(a.tempo_resolucao_min)}</td>
                    <td className="py-2.5 text-right">{fmt.num(a.satisfacao)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
