import * as mock from "./mock.js";
import { ApiError } from "./errors.js";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000") + "/api";

const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem storage */ } },
};

export { ApiError };

/*
  Chama o backend seguindo docs/api-contract.md.
  Enquanto a rota não existe no backend (404/405/501) ou o backend está fora do ar,
  responde com os dados de exemplo de mock.js no mesmo formato do contrato.
*/
async function request(method, path, body, fallback) {
  let res;
  try {
    const token = storage.get("radar.token");
    res = await fetch(API_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return fallback();
  }
  if ([404, 405, 501].includes(res.status) && !(await isContractError(res.clone()))) return fallback();
  if (res.status === 401 && path !== "/auth/login") {
    // Token ausente, expirado ou do login de exemplo: volta para a tela de entrada.
    storage.set("radar.token", null);
    storage.set("radar.usuario", null);
    if (window.location.pathname !== "/login") window.location.assign("/login");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.erro?.codigo ?? "erro_interno", data?.erro?.mensagem ?? "Não foi possível carregar os dados.", res.status);
  }
  return res.json();
}

// 404 no formato do contrato ({erro:{codigo}}) é um "não encontrado" real, não rota ausente.
async function isContractError(res) {
  const data = await res.json().catch(() => null);
  return Boolean(data?.erro?.codigo);
}

const qs = (params = {}) => {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  async login(email, senha) {
    const data = await request("POST", "/auth/login", { email, senha }, () => mock.login(email));
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
  painel: () => request("GET", "/painel", null, mock.painel),
  clientes: (filtros) => request("GET", "/clientes" + qs(filtros), null, () => mock.clientes(filtros)),
  cliente: (id) => request("GET", `/clientes/${id}`, null, () => mock.cliente(id)),
  acao: (id, formato) => request("POST", `/clientes/${id}/acao`, { formato }, () => mock.acao(id, formato)),
  contato: (id, observacao) => request("POST", `/clientes/${id}/contato`, observacao ? { observacao } : {}, () => mock.contato(id)),
  fila: (filtros) => request("GET", "/atendimentos/fila" + qs(filtros), null, () => mock.fila(filtros)),
};
