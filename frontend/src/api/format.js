// Valor ausente é null e aparece como "—", nunca 0, NaN ou "null".
const DASH = "—";
const isEmpty = (v) => v === null || v === undefined || Number.isNaN(v);

export const fmt = {
  dash: DASH,
  num: (v, digits = 0) =>
    isEmpty(v) ? DASH : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  nota: (v) => (isEmpty(v) ? DASH : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
  minutos: (v) => {
    if (isEmpty(v)) return DASH;
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
  },
  data: (iso) => {
    if (!iso) return DASH;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? DASH : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  },
  mes: (m) => {
    if (!m) return DASH;
    const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return nomes[Number(m.slice(5, 7)) - 1] ?? m;
  },
  mesAno: (iso) => {
    if (!iso) return DASH;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? DASH : d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(". de ", "/").replace(" de ", "/");
  },
};

export const FAIXA_LABEL = { alto: "Alto risco", atencao: "Atenção", saudavel: "Saudável" };
export const PERFIL_LABEL = { silencioso: "Silencioso", frustrado: "Frustrado", travado: "Travado", saudavel: "Saudável" };
export const FORMATO_LABEL = { ligacao: "Ligação", email: "E-mail", whatsapp: "WhatsApp" };

