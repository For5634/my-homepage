import promptModule from "../../src/digitalTwinPrompt.js";

const { digitalTwinSystemPrompt } = promptModule;

const fallbackReply =
  "DeepSeek 暂时没有成功返回，我先用本地信息兜底：Mike 是西南交通大学研究生，本科是河南工业大学计算机科学与技术专业，关注联邦持续学习、AI 工具辅助开发和后端项目实践。做过黑马点评、苍穹外卖、AI 私厨等项目，可以通过 1360237325@qq.com 联系他。";
const maxRequestBytes = 32_000;

function getEnvValue(key, fallback = "") {
  return globalThis.Netlify?.env?.get?.(key) || process.env[key] || fallback;
}

function sanitizeHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message) => ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 900),
    }))
    .slice(-8);
}

function buildDeepSeekMessages(question, history) {
  return [
    {
      role: "system",
      content: digitalTwinSystemPrompt,
    },
    ...sanitizeHistory(history),
    { role: "user", content: question },
  ];
}

function createSseResponse(status, producer) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, payload) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      try {
        await producer(send);
      } catch (error) {
        console.error(error);
        send("error", { reply: fallbackReply });
        send("done", {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get("content-length")) || 0;

  if (contentLength > maxRequestBytes) {
    return { error: "Request body too large", status: 413 };
  }

  const body = await request.text();

  if (Buffer.byteLength(body) > maxRequestBytes) {
    return { error: "Request body too large", status: 413 };
  }

  try {
    return { body: body ? JSON.parse(body) : {} };
  } catch (error) {
    return { error: "Invalid JSON", status: 400 };
  }
}

async function streamDeepSeek(question, history) {
  const apiKey = getEnvValue("DEEPSEEK_API_KEY");

  if (!apiKey) {
    return createSseResponse(503, async (send) => {
      send("error", {
        reply:
          "我已经准备好接入 DeepSeek V4 了，不过 Netlify 环境变量还没有配置 DEEPSEEK_API_KEY。配置后再问我，我就可以用大模型来回答啦。",
      });
      send("done", {});
    });
  }

  const apiUrl = getEnvValue("DEEPSEEK_API_URL", "https://api.deepseek.com/chat/completions");
  const model = getEnvValue("DEEPSEEK_MODEL", "deepseek-v4-flash");
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 60_000);

  try {
    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: buildDeepSeekMessages(question, history),
        stream: true,
        temperature: 0.7,
        max_tokens: 700,
      }),
      signal: abortController.signal,
    });

    if (!apiResponse.ok) {
      const responseText = await apiResponse.text();
      throw new Error(`DeepSeek API responded with ${apiResponse.status}: ${responseText}`);
    }

    return createSseResponse(200, async (send) => {
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        for await (const chunk of apiResponse.body) {
          buffer += decoder.decode(chunk, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");
          const events = buffer.split("\n\n");
          buffer = events.pop();

          for (const eventText of events) {
            const dataLines = eventText
              .split(/\r?\n/)
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim());

            for (const dataLine of dataLines) {
              if (dataLine === "[DONE]") {
                send("done", {});
                return;
              }

              if (!dataLine) {
                continue;
              }

              const data = JSON.parse(dataLine);
              const delta = data.choices?.[0]?.delta?.content || "";

              if (delta) {
                send("delta", { text: delta });
              }
            }
          }
        }

        send("done", {});
      } finally {
        clearTimeout(timeout);
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error(error);
    return createSseResponse(502, async (send) => {
      send("error", { reply: fallbackReply });
      send("done", {});
    });
  }
}

export default async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const { body, error, status } = await readJsonBody(request);

  if (error) {
    return Response.json({ error }, { status });
  }

  const question = String(body.question || "").trim();

  if (!question) {
    return Response.json({ error: "Question is required" }, { status: 400 });
  }

  return streamDeepSeek(question.slice(0, 1200), body.history);
};

export const config = {
  path: "/api/chat",
  method: ["POST"],
};
