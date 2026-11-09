// Dados de exemplo no formato de docs/api-contract.md.
// Usados só enquanto o backend não expõe a rota. Números ilustrativos, gerados com semente fixa.
import { ApiError } from "./errors.js";
import { faixaDoScore } from "./format.js";

const SETORES = ["Comércio", "Indústria", "Serviços", "Tecnologia"];
const CIDADES = ["Canoas", "Porto Alegre", "Gravataí", "Novo Hamburgo", "Cachoeirinha", "Esteio"];
const PORTES = ["Micro", "Pequena", "Média"];
const SERVICOS = ["Sistema Alfa", "Sistema Beta", "Portal Web", "Aplicativo Mobile"];
const ASSUNTOS = ["Acesso e senha", "Atualização", "Dúvida de utilização", "Erro no sistema", "Instalação", "Lentidão", "Relatório", "Solicitação de melhoria"];
const CANAIS = ["E-mail", "Portal", "Telefone", "WhatsApp"];
const PRIORIDADES = ["Baixa", "Normal", "Alta"];
const MESES = ["2026-07", "2026-08", "2026-09"];
const PESOS = { engajamento: 0.4, atrito: 0.35, satisfacao: 0.25 };
const PORTE_PESO = { Micro: 1, Pequena: 2, "Média": 3 };

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(2026);
const pick = (arr) => arr[Math.floor(r() * arr.length)];
const between = (a, b) => Math.round(a + r() * (b - a));
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function gerarBase() {
  const scores = [
    ...Array.from({ length: 14 }, () => between(70, 92)),
    ...Array.from({ length: 26 }, () => between(40, 69)),
    ...Array.from({ length: 60 }, () => between(5, 39)),
  ].sort(() => r() - 0.5);

  const clientes = [];
  const atendimentos = [];
  let seqAtend = 1;

  scores.forEach((score, i) => {
    const id = `C${String(i + 1).padStart(3, "0")}`;
    const faixa = faixaDoScore(score);
    // Divide o score entre as facetas; a soma das contribuições é igual ao score.
    // Cada faceta tem teto = peso × 100; distribui ponto a ponto respeitando o teto.
    const teto = { engajamento: 40, atrito: 35, satisfacao: 25 };
    const chance = { engajamento: r() + 0.2, atrito: r() + 0.2, satisfacao: r() + 0.2 };
    const contrib = { engajamento: 0, atrito: 0, satisfacao: 0 };
    for (let p = 0; p < score; p++) {
      const livres = Object.keys(contrib).filter((k) => contrib[k] < teto[k]);
      const soma = livres.reduce((a, k) => a + chance[k], 0);
      let x = r() * soma;
      const alvo = livres.find((k) => (x -= chance[k]) <= 0) ?? livres[0];
      contrib[alvo] += 1;
    }

    const queda = Math.round((contrib.engajamento / 40) * 70);
    const servicosUso = MESES.map(() => pick(SERVICOS));
    const baseOps = between(600, 1600);
    const baseAcc = Math.round(baseOps * (0.3 + r() * 0.2));
    const uso = MESES.map((mes, m) => {
      const fator = 1 - (queda / 100) * (m / 2) + (r() - 0.5) * 0.06;
      return { mes, servico: servicosUso[m], acessos: Math.max(5, Math.round(baseAcc * fator)), operacoes: Math.max(10, Math.round(baseOps * fator)) };
    });

    const qtdPendentes = Math.min(3, Math.floor(contrib.atrito / 15));
    const qtdAtend = Math.max(qtdPendentes, between(1, 5));
    const notaAlvo = Math.max(1, Math.min(5, 5 - (contrib.satisfacao / 25) * 3.5));
    const assuntoFixo = pick(ASSUNTOS);
    const meus = [];
    for (let k = 0; k < qtdAtend; k++) {
      const pendente = k < qtdPendentes;
      const dia = pendente ? between(1, 40) : between(20, 95);
      const data = new Date(Date.UTC(2026, 8, 30, 9 + between(0, 8), between(0, 59)) - dia * 86400000);
      meus.push({
        atendimento_id: `A${String(seqAtend++).padStart(4, "0")}`,
        cliente_id: id,
        data_abertura: data.toISOString().slice(0, 19),
        servico: pick(SERVICOS),
        assunto: r() < 0.45 ? assuntoFixo : pick(ASSUNTOS),
        canal: pick(CANAIS),
        prioridade: pendente && contrib.atrito > 20 ? "Alta" : pick(PRIORIDADES),
        status: pendente ? "Pendente" : "Resolvido",
        tempo_resolucao_min: pendente ? null : between(40, 600),
        satisfacao: pendente ? null : Math.max(1, Math.min(5, Math.round(notaAlvo + (r() - 0.5) * 1.5))),
      });
    }
    meus.sort((a, b) => b.data_abertura.localeCompare(a.data_abertura));
    atendimentos.push(...meus);

    const notas = meus.map((a) => a.satisfacao).filter((n) => n !== null);
    const satisfacao_media = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null;
    const pendentes = meus.filter((a) => a.status === "Pendente");
    const recorrente = ASSUNTOS.find((s) => meus.filter((a) => a.assunto === s).length >= 2);

    const dominante = Object.entries(contrib).sort((a, b) => b[1] - a[1])[0][0];
    const perfil = faixa === "saudavel" ? "saudavel" : { engajamento: "silencioso", satisfacao: "frustrado", atrito: "travado" }[dominante];
    const quedaOps = Math.round((1 - uso[2].operacoes / uso[0].operacoes) * 100);
    const motivos = {
      engajamento: quedaOps > 0 ? `Operações caíram ${quedaOps}% desde julho` : "Uso estável no trimestre",
      atrito: pendentes.length ? `${pendentes.length} ${pendentes.length > 1 ? "chamados pendentes" : "chamado pendente"}` : "Chamados resolvidos com demora",
      satisfacao: satisfacao_media !== null ? `Nota média ${String(satisfacao_media).replace(".", ",")}` : "Sem avaliação recente",
    };
    const cadastro = new Date(Date.UTC(2021 + between(0, 5), between(0, 11), between(1, 28)));
    if (cadastro > new Date(Date.UTC(2026, 8, 1))) cadastro.setUTCFullYear(2025);
    const meses_de_casa = Math.max(1, Math.round((Date.UTC(2026, 9, 1) - cadastro) / (30.4 * 86400000)));

    const notaFaceta = (f) => Math.min(100, Math.round(contrib[f] / PESOS[f]));
    clientes.push({
      cliente_id: id,
      nome: `Empresa Exemplo ${String(i + 1).padStart(3, "0")}`,
      porte: pick(PORTES),
      setor: pick(SETORES),
      cidade: pick(CIDADES),
      data_cadastro: cadastro.toISOString().slice(0, 10),
      meses_de_casa,
      score,
      faixa,
      perfil,
      motivo_principal: faixa === "saudavel" ? "Uso e atendimento estáveis" : motivos[dominante],
      uso,
      pendentes: pendentes.length,
      satisfacao_media,
      contatado_em: null,
      facetas: {
        engajamento: {
          nota: notaFaceta("engajamento"), peso: PESOS.engajamento, contribuicao: contrib.engajamento,
          descricao: quedaOps > 0 ? `Operações caíram ${quedaOps}% entre jul e set` : "Operações estáveis entre jul e set",
        },
        atrito: {
          nota: notaFaceta("atrito"), peso: PESOS.atrito, contribuicao: contrib.atrito,
          descricao: pendentes.length
            ? `${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}, ${pendentes.filter((a) => a.prioridade === "Alta").length} de prioridade alta`
            : "Nenhum chamado pendente",
        },
        satisfacao: {
          nota: notaFaceta("satisfacao"), peso: PESOS.satisfacao, contribuicao: contrib.satisfacao,
          descricao: satisfacao_media !== null ? `Nota média ${String(satisfacao_media).replace(".", ",")} nos chamados resolvidos` : "Nenhum chamado avaliado",
        },
      },
      contexto: {
        impacto: null,
        sinais: [...(meses_de_casa <= 6 ? ["cliente_recente"] : []), ...(recorrente ? [`assunto_recorrente:${recorrente}`] : [])],
      },
    });
  });
  clientes.forEach((c) => (c.contexto.impacto = c.porte));
  return { clientes, atendimentos };
}

const db = gerarBase();

const resumo = (c) => ({
  cliente_id: c.cliente_id, nome: c.nome, porte: c.porte, setor: c.setor, cidade: c.cidade,
  score: c.score, faixa: c.faixa, perfil: c.perfil, motivo_principal: c.motivo_principal,
  uso_total: c.uso.map(({ mes, acessos, operacoes }) => ({ mes, acessos, operacoes })),
  pendentes: c.pendentes, satisfacao_media: c.satisfacao_media, contatado_em: c.contatado_em,
});

const porPrioridade = (a, b) => b.score - a.score || PORTE_PESO[b.porte] - PORTE_PESO[a.porte];

export async function login(email) {
  await wait(300);
  const papel = String(email).toLowerCase().includes("gestor") ? "gestor" : "analista";
  return {
    token: `exemplo-${papel}`,
    usuario: { id: papel === "gestor" ? 2 : 1, nome: papel === "gestor" ? "Gabriel Gestor" : "Ana Analista", papel },
  };
}

export async function painel() {
  await wait(400);
  const pend = db.atendimentos.filter((a) => a.status === "Pendente");
  const resolvidos = db.atendimentos.filter((a) => a.status === "Resolvido");
  const notas = resolvidos.map((a) => a.satisfacao).filter((n) => n !== null);
  const conta = (campo, valor) => db.clientes.filter((c) => c[campo] === valor).length;
  return {
    kpis: {
      clientes_alto_risco: conta("faixa", "alto"),
      clientes_alto_risco_variacao: 4,
      atendimentos_pendentes: pend.length,
      pendentes_prioridade_alta: pend.filter((a) => a.prioridade === "Alta").length,
      satisfacao_media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
      tempo_medio_resolucao_min: Math.round(resolvidos.reduce((a, b) => a + b.tempo_resolucao_min, 0) / resolvidos.length),
    },
    distribuicao: { alto: conta("faixa", "alto"), atencao: conta("faixa", "atencao"), saudavel: conta("faixa", "saudavel") },
    perfis: Object.fromEntries(["silencioso", "frustrado", "travado", "saudavel"].map((p) => [p, conta("perfil", p)])),
    prioridade_hoje: [...db.clientes].sort(porPrioridade).slice(0, 5).map(resumo),
    atendimentos_por_servico: SERVICOS.map((servico) => {
      const doServico = db.atendimentos.filter((a) => a.servico === servico);
      return { servico, total: doServico.length, pendentes: doServico.filter((a) => a.status === "Pendente").length };
    }),
  };
}

export async function clientes(f = {}) {
  await wait(350);
  const busca = (f.busca || "").trim().toLowerCase();
  let itens = db.clientes.filter((c) =>
    (!busca || c.nome.toLowerCase().includes(busca) || c.cliente_id.toLowerCase().includes(busca)) &&
    (!f.faixa || c.faixa === f.faixa) &&
    (!f.perfil || c.perfil === f.perfil) &&
    (!f.porte || c.porte === f.porte) &&
    (!f.setor || c.setor === f.setor) &&
    (!f.cidade || c.cidade === f.cidade) &&
    (!f.servico || c.uso.some((u) => u.servico === f.servico)));
  const ordenar = f.ordenar || "prioridade";
  const dir = f.direcao === "asc" ? -1 : 1;
  itens.sort((a, b) => {
    if (ordenar === "nome") return dir * b.nome.localeCompare(a.nome);
    if (ordenar === "score") return dir * (b.score - a.score);
    return dir * porPrioridade(a, b);
  });
  return { total: itens.length, itens: itens.map(resumo) };
}

export async function cliente(id) {
  await wait(400);
  const c = db.clientes.find((x) => x.cliente_id === id);
  if (!c) throw new ApiError("nao_encontrado", `Cliente ${id} não existe na carteira.`, 404);
  return {
    cliente: { cliente_id: c.cliente_id, nome: c.nome, porte: c.porte, setor: c.setor, cidade: c.cidade, data_cadastro: c.data_cadastro, meses_de_casa: c.meses_de_casa },
    score: c.score, faixa: c.faixa, perfil: c.perfil, facetas: c.facetas, contexto: c.contexto, uso: c.uso,
    atendimentos: db.atendimentos.filter((a) => a.cliente_id === id),
    contatado_em: c.contatado_em,
  };
}

export async function acao(id, formato) {
  await wait(1200);
  const c = db.clientes.find((x) => x.cliente_id === id);
  if (!c) throw new ApiError("nao_encontrado", `Cliente ${id} não existe na carteira.`, 404);
  const pend = db.atendimentos.filter((a) => a.cliente_id === id && a.status === "Pendente");
  const primeiro = pend[0];
  const queda = c.facetas.engajamento.descricao.toLowerCase();
  const canal = { ligacao: "Ligar hoje", email: "Enviar e-mail hoje", whatsapp: "Mandar mensagem no WhatsApp hoje" }[formato];
  const abertura = {
    ligacao: `"Oi, aqui é do time de sucesso do cliente. Quero entender como está o uso do ${c.uso[2].servico} por aí."`,
    email: `Assunto: Como podemos ajudar com o ${c.uso[2].servico}?`,
    whatsapp: `"Olá! Sou do time de sucesso do cliente. Posso te ajudar com o ${c.uso[2].servico} hoje?"`,
  }[formato];
  return {
    fonte: "regras",
    resumo: `Cliente de porte ${c.porte.toLowerCase()} do setor de ${c.setor.toLowerCase()} em ${c.cidade}. ${c.facetas.engajamento.descricao}; ${c.facetas.atrito.descricao.toLowerCase()}; ${c.facetas.satisfacao.descricao.toLowerCase()}.`,
    proximo_passo: primeiro
      ? `${canal}, resolver primeiro o chamado de ${primeiro.assunto.toLowerCase()} e agendar uma revisão de uso.`
      : `${canal} para entender por que ${queda.startsWith("operações caíram") ? "o uso caiu" : "o cliente está insatisfeito"} e oferecer uma revisão de uso.`,
    roteiro: [
      abertura,
      primeiro ? `Confirmar que o chamado ${primeiro.atendimento_id} (${primeiro.assunto}) já está com o suporte e dar um prazo.` : "Perguntar quais rotinas deixaram de passar pelo sistema.",
      "Oferecer uma sessão de 30 minutos com o suporte técnico ainda esta semana.",
    ],
    baseado_em: { atendimentos: db.atendimentos.filter((a) => a.cliente_id === id).length, meses_de_uso: c.uso.length },
  };
}

export async function contato(id) {
  await wait(250);
  const c = db.clientes.find((x) => x.cliente_id === id);
  if (!c) throw new ApiError("nao_encontrado", `Cliente ${id} não existe na carteira.`, 404);
  c.contatado_em = new Date().toISOString().slice(0, 19);
  return { cliente_id: id, contatado_em: c.contatado_em };
}

const RANK = { Normal: 0, Alta: 1, "Crítica": 2 };

export async function fila(f = {}) {
  await wait(350);
  const hoje = Date.UTC(2026, 9, 1);
  let itens = db.atendimentos
    .filter((a) => a.status === "Pendente")
    .filter((a) => (!f.servico || a.servico === f.servico) && (!f.assunto || a.assunto === f.assunto) && (!f.canal || a.canal === f.canal))
    .map((a) => {
      const c = db.clientes.find((x) => x.cliente_id === a.cliente_id);
      const dias_aberto = Math.max(0, Math.round((hoje - Date.parse(a.data_abertura + "Z")) / 86400000));
      let sugerida = a.prioridade === "Alta" ? "Alta" : "Normal";
      let motivo = a.prioridade === "Alta" ? "Prioridade informada" : null;
      if (c.faixa === "alto") { sugerida = "Crítica"; motivo = "Cliente em alto risco"; }
      else if (c.pendentes >= 3) { sugerida = "Crítica"; motivo = `${c.pendentes}º pendente do cliente`; }
      else if (c.satisfacao_media !== null && c.satisfacao_media < 2.5) { sugerida = "Alta"; motivo = `Nota média ${String(c.satisfacao_media).replace(".", ",")}`; }
      else if (c.faixa === "atencao" && sugerida === "Normal") { sugerida = "Alta"; motivo = "Cliente em atenção"; }
      return { atendimento: a, cliente: { cliente_id: c.cliente_id, nome: c.nome, score: c.score, faixa: c.faixa }, prioridade_sugerida: sugerida, dias_aberto, motivo };
    });
  if (f.ordem === "chegada") itens.sort((a, b) => a.atendimento.data_abertura.localeCompare(b.atendimento.data_abertura));
  else itens.sort((a, b) => RANK[b.prioridade_sugerida] - RANK[a.prioridade_sugerida] || b.cliente.score - a.cliente.score || b.dias_aberto - a.dias_aberto);
  return { total: itens.length, itens: itens.map((it, i) => ({ posicao: i + 1, ...it })) };
}
