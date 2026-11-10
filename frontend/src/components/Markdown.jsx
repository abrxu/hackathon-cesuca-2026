import { Link } from "react-router-dom";

// Renderizador mínimo e seguro (sem HTML cru) para as respostas do Eco:
// parágrafos, ### títulos, listas (- e 1.), tabelas GFM, **negrito**, *itálico*, `código`
// e códigos de cliente (C022) viram link para o Cliente 360.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\bC\d{3}\b)/g;

function inline(texto, key = "") {
  return String(texto).split(INLINE).filter(Boolean).map((p, i) => {
    const k = `${key}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={k} className="font-bold text-ink">{inline(p.slice(2, -2), k)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={k} className="rounded bg-ink/5 px-1 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>;
    if (/^\*[^*].*\*$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>;
    if (/^C\d{3}$/.test(p)) return <Link key={k} to={`/clientes/${p}`} className="font-semibold text-ai underline decoration-ai/30 underline-offset-2 hover:decoration-ai">{p}</Link>;
    return p;
  });
}

const celulas = (linha) => linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const ehSeparador = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

function blocos(md) {
  const linhas = String(md || "").replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    if (l.includes("|") && ehSeparador(linhas[i + 1] || "")) {
      const head = celulas(l);
      const rows = [];
      i += 2;
      while (i < linhas.length && linhas[i].includes("|") && linhas[i].trim()) rows.push(celulas(linhas[i++]));
      out.push({ t: "table", head, rows });
      continue;
    }
    const h = l.match(/^#{1,6}\s+(.*)/);
    if (h) { out.push({ t: "h", txt: h[1] }); i++; continue; }
    if (/^\s*[-*•]\s+/.test(l)) {
      const itens = [];
      while (i < linhas.length && /^\s*[-*•]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*[-*•]\s+/, ""));
      out.push({ t: "ul", itens });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const itens = [];
      while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push({ t: "ol", itens });
      continue;
    }
    const par = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|\s*[-*•]\s|\s*\d+[.)]\s)/.test(linhas[i]) && !(linhas[i].includes("|") && ehSeparador(linhas[i + 1] || ""))) par.push(linhas[i++]);
    out.push({ t: "p", txt: par.join(" ") });
  }
  return out;
}

export default function Markdown({ children }) {
  return (
    <div className="space-y-2.5">
      {blocos(children).map((b, i) => {
        if (b.t === "h") return <p key={i} className="pt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{inline(b.txt, i)}</p>;
        if (b.t === "ul") return (
          <ul key={i} className="space-y-1">
            {b.itens.map((it, j) => <li key={j} className="flex gap-2"><span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-ai/60" />{<span>{inline(it, `${i}.${j}`)}</span>}</li>)}
          </ul>
        );
        if (b.t === "ol") return (
          <ol key={i} className="space-y-1">
            {b.itens.map((it, j) => <li key={j} className="flex gap-2"><span className="w-4 shrink-0 text-right font-bold text-ai">{j + 1}.</span><span>{inline(it, `${i}.${j}`)}</span></li>)}
          </ol>
        );
        if (b.t === "table") return (
          <div key={i} className="-mx-1 overflow-x-auto rounded-lg border border-ink/10">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-ai-soft">
                <tr>{b.head.map((c, j) => <th key={j} className="whitespace-nowrap px-2 py-1.5 text-left font-bold text-ink">{inline(c, `${i}h${j}`)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-t border-ink/10 odd:bg-canvas even:bg-ink/[0.02]">
                    {b.head.map((_, k) => <td key={k} className={`px-2 py-1.5 align-top ${k === b.head.length - 1 && b.head.length > 2 ? "min-w-[7rem]" : "whitespace-nowrap"}`}>{inline(r[k] ?? "", `${i}.${j}.${k}`)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        const passo = b.txt.match(/^\*{0,2}Próximo passo:?\*{0,2}:?\s*(.*)/i);
        if (passo) return (
          <p key={i} className="rounded-lg border-l-4 border-ai bg-ai-soft px-3 py-2">
            <span className="block text-xs font-bold uppercase tracking-wide text-ai">Próximo passo</span>
            {inline(passo[1].charAt(0).toUpperCase() + passo[1].slice(1), i)}
          </p>
        );
        return <p key={i}>{inline(b.txt, i)}</p>;
      })}
    </div>
  );
}
