import { todayISO } from "./format.js";

function resolverData(token) {
  const hoje = new Date();
  if (!token) return todayISO();
  const t = token.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t === "hoje") return todayISO();
  if (t === "amanha") {
    const d = new Date(hoje); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const dias = { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0 };
  if (dias[t] !== undefined) {
    const d = new Date(hoje);
    const diff = (dias[t] - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  const dmMatch = token.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmMatch) {
    const year = hoje.getFullYear();
    return `${year}-${dmMatch[2].padStart(2, "0")}-${dmMatch[1].padStart(2, "0")}`;
  }
  return todayISO();
}

function resolverHorario(token) {
  if (!token) return "09:00";
  const m = token.match(/(\d{1,2})[h:](\d{0,2})/i);
  if (m) return `${m[1].padStart(2, "0")}:${(m[2] || "00").padStart(2, "0")}`;
  const soHora = token.match(/^(\d{1,2})$/);
  if (soHora) return `${soHora[1].padStart(2, "0")}:00`;
  return "09:00";
}

export function parsearLocal(texto) {
  const t = texto.trim();

  if (/^(relat[oó]rio|resumo|como\s+t[oô]|status)\s*$/i.test(t)) {
    return { action: "relatorio", params: {} };
  }

  const gastoM = t.match(/^(?:gasto(?:i)?|gastei|paguei|comprei)\s+(?:de\s+)?(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+(?:(?:em|no|na|num|numa)\s+)?(.+)/i);
  if (gastoM) {
    const valor = parseFloat(gastoM[1].replace(",", "."));
    return { action: "gasto", params: { valor, descricao: gastoM[2].trim() } };
  }

  const tarefaM = t.match(/^(?:tarefa|criar?\s+tarefa|add\s+tarefa)\s+(.+)/i);
  if (tarefaM) {
    return { action: "tarefa", params: { titulo: tarefaM[1].trim() } };
  }

  const lembM = t.match(/^(?:lembrete?|lembrar?|lembra)\s+(.+?)(?:\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}[\/\-]\d{1,2}))?(?:\s+(?:às?\s+)?(\d{1,2}[h:]?\d{0,2}))?$/i);
  if (lembM) {
    return {
      action: "lembrete",
      params: {
        titulo: lembM[1].trim(),
        data: resolverData(lembM[2]),
        horario: resolverHorario(lembM[3]),
      },
    };
  }

  const eventoM = t.match(/^(.+?)\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}[\/\-]\d{1,2})\s+(?:às?\s+)?(\d{1,2}[h:]?\d{0,2})/i);
  if (eventoM) {
    return {
      action: "evento",
      params: {
        titulo: eventoM[1].trim(),
        data: resolverData(eventoM[2]),
        horario: resolverHorario(eventoM[3]),
      },
    };
  }

  return null;
}

export async function parsear(texto, apiKeys = {}) {
  const local = parsearLocal(texto);
  if (local) return local;

  const key = apiKeys.anthropic || apiKeys.gemini;
  if (!key) return { action: "desconhecido", params: { texto } };

  try {
    const prompt = `Interprete este comando em português e retorne JSON com "action" e "params".
Actions possíveis: gasto (params: valor number, descricao string), evento (params: titulo, data YYYY-MM-DD, horario HH:MM), tarefa (params: titulo), lembrete (params: titulo, data YYYY-MM-DD, horario HH:MM), relatorio (params: {}).
Data de hoje: ${todayISO()}
Comando: "${texto}"
Responda APENAS JSON válido, sem markdown.`;

    let result;
    if (apiKeys.anthropic) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: apiKeys.anthropic, dangerouslyAllowBrowser: true });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      result = JSON.parse(msg.content[0].text);
    } else {
      const { callGemini } = await import("./gemini.js");
      const raw = await callGemini(prompt, apiKeys.gemini);
      result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    }
    return result;
  } catch {
    return { action: "desconhecido", params: { texto } };
  }
}
