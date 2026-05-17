const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { digitalTwinSystemPrompt } = require("./digitalTwinPrompt");

const projectRoot = path.join(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

function loadEnvFile(envPath = path.join(projectRoot, ".env")) {
  if (!fsSync.existsSync(envPath)) {
    return;
  }

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      return;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  });
}

loadEnvFile();

const defaultPort = Number(process.env.PORT) || 3000;
const deepSeekApiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const maxRequestBytes = 32_000;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jfif": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function resolvePublicPath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relativePath);
  const isInsidePublic =
    filePath === publicDir || filePath.startsWith(`${publicDir}${path.sep}`);

  return isInsidePublic ? filePath : null;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function startSse(response, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders?.();
}

function writeSse(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxRequestBytes) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(Object.assign(error, { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
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

async function streamDeepSeek(question, history, request, response) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    startSse(response, 503);
    writeSse(response, "error", {
      reply:
        "我已经准备好接入 DeepSeek V4 了，不过本地服务还没有配置 DEEPSEEK_API_KEY。配置后再问我，我就可以用大模型来回答啦。",
    });
    writeSse(response, "done", {});
    response.end();
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  response.on("close", () => {
    if (!response.writableEnded) {
      controller.abort();
    }
  });

  try {
    const apiResponse = await fetch(deepSeekApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: deepSeekModel,
        messages: buildDeepSeekMessages(question, history),
        stream: true,
        temperature: 0.7,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });

    startSse(response, apiResponse.ok ? 200 : 502);

    if (!apiResponse.ok) {
      const responseText = await apiResponse.text();
      throw new Error(`DeepSeek API responded with ${apiResponse.status}: ${responseText}`);
    }

    const decoder = new TextDecoder();
    let buffer = "";

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
            writeSse(response, "done", {});
            response.end();
            return;
          }

          if (!dataLine) {
            continue;
          }

          const data = JSON.parse(dataLine);
          const delta = data.choices?.[0]?.delta?.content || "";

          if (delta) {
            writeSse(response, "delta", { text: delta });
          }
        }
      }
    }

    writeSse(response, "done", {});
    response.end();
  } catch (error) {
    if (!response.headersSent) {
      startSse(response, error.statusCode || 502);
    }

    writeSse(response, "error", {
      reply:
        "DeepSeek 暂时没有成功返回，我先用本地信息兜底：Mike 是西南交通大学研究生，本科是河南工业大学计算机科学与技术专业，关注联邦持续学习、AI 工具辅助开发和后端项目实践。做过黑马点评、苍穹外卖、AI 私厨等项目，可以通过 1360237325@qq.com 联系他。",
    });
    writeSse(response, "done", {});
    response.end();
  } finally {
    clearTimeout(timeout);
  }
}

async function handleChatRequest(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const question = String(body.question || "").trim();

    if (!question) {
      sendJson(response, 400, { error: "Question is required" });
      return;
    }

    await streamDeepSeek(question.slice(0, 1200), body.history, request, response);
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 400, { error: "Chat request failed" });
    }
  }
}

async function sendFile(request, response, filePath) {
  const body = await fs.readFile(filePath);
  const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });

  response.end(request.method === "HEAD" ? undefined : body);
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/api/chat") {
    await handleChatRequest(request, response);
    return;
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  const filePath = resolvePublicPath(request.url);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    await sendFile(request, response, filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal Server Error");
  }
}

function createServer() {
  return http.createServer((request, response) => {
    handleRequest(request, response);
  });
}

function startServer(port = defaultPort) {
  const server = createServer();

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`Mike homepage is running at http://localhost:${actualPort}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createServer, loadEnvFile, resolvePublicPath, startServer };
