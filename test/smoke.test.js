const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const test = require("node:test");

const { createServer } = require("../src/index.js");

test("server can be created", () => {
  const server = createServer();

  assert.equal(typeof server.listen, "function");
  server.close();
});

test("home page is served with Mike profile and chat area", async (t) => {
  const server = createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Mike/);
  assert.match(body, /西南交通大学研究生|西南交通大学 · 研究生/);
  assert.match(body, /河南工业大学计算机科学与技术专业/);
  assert.match(body, /C²Prompt/);
  assert.match(body, /Vibe Coding/);
  assert.match(body, /黑马点评/);
  assert.match(body, /苍穹外卖/);
  assert.match(body, /AI 私厨/);
  assert.match(body, /摄影碎片/);
  assert.match(body, /拍照记录/);
  assert.match(body, /assets\/photography\/photo-01\.jpg/);
  assert.match(body, /starfall/);
  assert.match(body, /ai-atmosphere\.jpg/);
  assert.match(body, /西南交通大学校徽与校名/);
  assert.match(body, /swjtu-logo\.png/);
  assert.match(body, /mike-profile\.jpg\?v=20260517-anime/);
  assert.match(body, /https:\/\/github\.com\/For5634/);
  assert.match(body, /1360237325@qq\.com/);
  assert.match(body, /莫要与人比/);
  assert.match(body, /学习技术栈/);
  assert.match(body, /Spring Boot/);
  assert.match(body, /Redis/);
  assert.match(body, /DeepSeek V4/);
  assert.match(body, /数字分身聊天|Mike 的数字分身/);
});

test("chat API streams missing DeepSeek API key message without leaking secrets", async (t) => {
  const originalApiKey = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  const server = createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.close();
    if (originalApiKey) {
      process.env.DEEPSEEK_API_KEY = originalApiKey;
    }
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question: "你现在在做什么？" }),
  });
  const body = await response.text();

  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(body, /event: error/);
  assert.match(body, /DEEPSEEK_API_KEY/);
  assert.match(body, /event: done/);
});

test("Netlify deployment config exposes the streamed chat function", () => {
  const netlifyConfig = fs.readFileSync("netlify.toml", "utf8");
  const chatFunction = fs.readFileSync("netlify/functions/chat.mjs", "utf8");

  assert.match(netlifyConfig, /publish = "public"/);
  assert.match(netlifyConfig, /functions = "netlify\/functions"/);
  assert.match(chatFunction, /path: "\/api\/chat"/);
  assert.match(chatFunction, /text\/event-stream/);
});
