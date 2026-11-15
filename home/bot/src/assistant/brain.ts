import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "../module.ts";

const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 1024;
const MAX_STEPS = 4;
const HISTORY_MS = 10 * 60_000;
const HISTORY_MESSAGES = 16;

const SYSTEM = `Eres «bebé», el bot de voz del servidor de Discord de un grupo de amigos. Te hablan en un canal de voz: cada mensaje te llega transcrito como «Nombre: texto», y la transcripción puede tener errores, así que interpreta lo que quisieron decir.

Tu respuesta se lee en voz alta con un sintetizador. Contesta en español de España, en una o dos frases cortas, sin emojis, listas, enlaces ni markdown.

Usa las herramientas cuando te pidan algo que ellas hagan, como poner o controlar música, y di en pocas palabras lo que has hecho. Si una herramienta falla o no puede hacerlo, dilo.

No des opiniones políticas, no hables de sexo y no opines ni bromees sobre las personas del canal ni sobre sus cuerpos: recházalo con una frase amable y cambia de tema.

Si el mensaje te nombra pero no te habla a ti (están hablando sobre ti) o no te pide nada, no respondas: devuelve una respuesta vacía.`;

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
let history: Anthropic.MessageParam[] = [];
let lastAt = 0;

export const ready = () => client !== null;

function trim(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const kept = messages.slice(-HISTORY_MESSAGES);
  while (kept.length && !(kept[0]!.role === "user" && typeof kept[0]!.content === "string")) kept.shift();
  return kept;
}

export async function respond(name: string, userId: string, text: string, tools: Tool[]): Promise<string> {
  if (!client) return "Ahora mismo no tengo el cerebro conectado.";
  if (Date.now() - lastAt > HISTORY_MS) history = [];
  lastAt = Date.now();
  const byName = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: `${name}: ${text}` }];
  let reply = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      tools: tools.map((tool) => tool.definition),
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages,
    });
    if (response.stop_reason === "refusal") {
      reply = "Eso prefiero no contestarlo.";
      messages.pop();
      break;
    }
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") {
      reply = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join(" ").trim();
      break;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const tool = byName.get(block.name);
      const content = tool ? await tool.run(block.input as Record<string, unknown>, userId).catch((error: Error) => `Error: ${error.message}`) : "Esa herramienta no existe.";
      console.log("assistant tool", block.name, JSON.stringify(block.input), "->", content);
      results.push({ type: "tool_result", tool_use_id: block.id, content });
    }
    messages.push({ role: "user", content: results });
  }
  history = trim(messages);
  return reply;
}
