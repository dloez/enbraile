import Anthropic from "@anthropic-ai/sdk";

export type Tool = {
  definition: Anthropic.Tool;
  run: (input: Record<string, unknown>, userId: string) => Promise<string>;
};

export type Ask = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Tool[];
  userId: string;
  model?: Anthropic.Model;
  maxTokens?: number;
  maxSteps?: number;
};

export type Answer = { reply: string; refused: boolean; messages: Anthropic.MessageParam[] };

const MODEL: Anthropic.Model = "claude-haiku-5-5";
const MAX_TOKENS = 1024;
const MAX_STEPS = 4;

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export const available = () => client !== null;

export async function ask({ system, messages, tools = [], userId, model = MODEL, maxTokens = MAX_TOKENS, maxSteps = MAX_STEPS }: Ask): Promise<Answer> {
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set");
  const byName = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const conversation = [...messages];
  for (let step = 0; step < maxSteps; step++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      tools: tools.map((tool) => tool.definition),
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: conversation,
    });
    if (response.stop_reason === "refusal") return { reply: "", refused: true, messages: conversation };
    conversation.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") {
      const reply = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join(" ").trim();
      return { reply, refused: false, messages: conversation };
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const tool = byName.get(block.name);
      const content = tool ? await tool.run(block.input as Record<string, unknown>, userId).catch((error: Error) => `Error: ${error.message}`) : `No tool named ${block.name}.`;
      results.push({ type: "tool_result", tool_use_id: block.id, content });
    }
    conversation.push({ role: "user", content: results });
  }
  return { reply: "", refused: false, messages: conversation };
}
