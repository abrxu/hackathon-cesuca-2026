import { ApiError } from "./errors.js";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000") + "/api";

const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem storage */ } },
};

export { ApiError };

function sairDaSessao() {
  storage.set("radar.token", null);
  storage.set("radar.usuario", null);
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

// Chama o backend seguindo docs/api-contract.md. Qualquer falha vira ApiError.
async function fetchAutenticado(method, path, body) {
  const token = storage.get("radar.token");
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("rede", "Não foi possível conectar ao servidor.", 0);
  }
  if (res.status === 401 && path !== "/auth/login") sairDaSessao();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.erro?.codigo ?? "erro_interno", data?.erro?.mensagem ?? "Não foi possível carregar os dados.", res.status);
  }
  return res;
}

const request = async (method, path, body) => (await fetchAutenticado(method, path, body)).json();

async function baixar(path, nomePadrao) {
  const res = await fetchAutenticado("GET", path);
  const blob = await res.blob();
  const cabecalho = res.headers.get("Content-Disposition") ?? "";
  const nome = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cabecalho)?.[1] ?? nomePadrao;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = decodeURIComponent(nome);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const qs = (params = {}) => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  async login(email, senha) {
    const data = await request("POST", "/auth/login", { email, senha });
    storage.set("radar.token", data.token);
    storage.set("radar.usuario", JSON.stringify(data.usuario));
    return data.usuario;
  },
  logout() {
    storage.set("radar.token", null);
    storage.set("radar.usuario", null);
  },
  usuarioSalvo() {
    try { return JSON.parse(storage.get("radar.usuario")); } catch { return null; }
  },
  painel: () => request("GET", "/painel"),
  clientes: (filtros) => request("GET", "/clientes" + qs(filtros)),
  cliente: (id) => request("GET", `/clientes/${id}`),
  acao: (id, formato) => request("POST", `/clientes/${id}/acao`, { formato }),
  contato: (id, observacao) => request("POST", `/clientes/${id}/contato`, observacao ? { observacao } : {}),
  fila: (filtros) => request("GET", "/atendimentos/fila" + qs(filtros)),
  insightsProduto: () => request("GET", "/insights/produto"),
  perguntar: (pergunta) => request("POST", "/agente/perguntar", { pergunta }),
  baixarRelatorio: (papel, formato, filtros) => baixar(`/relatorios/${papel}.${formato}${papel === "analista" ? qs(filtros) : ""}`, `relatorio-${papel}.${formato}`),
};
