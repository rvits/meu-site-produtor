import OpenAI from "openai";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function askAI(messages: ChatMessage[]) {
  // 🔒 Segurança total: não quebra se a key não existir
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY não configurada");
    return null;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `
Você é o suporte oficial da THouse Rec, um estúdio musical profissional.

Regras:
- Seja educado, direto e profissional
- Nunca invente preços
- Direcione o usuário para páginas do site
- Use o FAQ e a estrutura do site como referência
- Se não souber responder ou se o usuário pedir, escale para atendimento humano
        `,
      },
      ...messages,
    ],
  });

  return response.output_text ?? null;
}
