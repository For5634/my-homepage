const profile = {
  name: "Mike",
  role: "西南交通大学研究生",
  undergraduate: "河南工业大学计算机科学与技术专业",
  intro:
    "西南交通大学研究生，本科是河南工业大学计算机科学与技术专业，目前关注联邦持续学习，也在学习 AI 辅助开发范式（Vibe Coding）和 AI 工具辅助开发。",
  current:
    "最近在学习 AI 辅助开发范式（Vibe Coding），阅读联邦持续学习方向的论文，也在关注 AI 工具在开发和科研中的实际应用。",
  strengths: "联邦持续学习、AI 应用技巧、后端开发实践、AI 工具辅助开发。",
  stack:
    "学习技术栈包括联邦持续学习、Python、DeepSeek API、Agent 开发、vibe coding、Java、Spring Boot、MySQL、HTML/CSS/JS、Node.js 和 GitHub。",
  works:
    "做过黑马点评、苍穹外卖和 AI 私厨。黑马点评主要练 Spring Boot、Redis 缓存、秒杀、分布式锁和社交互动；苍穹外卖主要练餐品管理、订单处理、用户下单、商家后台和微信小程序流程；AI 私厨主要探索 AI 在生活服务和智能推荐场景里的应用。",
  contact: "邮箱是 1360237325@qq.com。GitHub 主页是 https://github.com/For5634。",
  motto: "莫要与人比，自古胜己者，胜于胜人。",
  traits:
    "学习上认真、喜欢研究技术、执行力强，表达比较直接，也比较注重实践。生活里喜欢吃喝玩乐、看剧、听歌、打游戏，也喜欢拍照记录路上的画面，整体就是比较真实、不太装。",
};

const replies = [
  {
    keywords: ["是谁", "介绍", "你是", "身份", "认识", "who"],
    answer: `我是 Mike 的数字分身。Mike 是西南交通大学研究生，本科是${profile.undergraduate}，目前关注联邦持续学习，也在学习 AI 辅助开发范式（Vibe Coding）和 AI 工具辅助开发。他做事比较认真直接，喜欢把问题讲清楚，也挺真实、不太装。`,
  },
  {
    keywords: ["现在", "最近", "做什么", "忙什么", "论文", "c2prompt", "vibe", "coding", "doing"],
    answer: `Mike ${profile.current} 现在的主线就是一边补科研和开发能力，一边把个人主页这类作品慢慢做扎实。`,
  },
  {
    keywords: ["作品", "项目", "demo", "portfolio", "黑马", "点评", "苍穹", "外卖", "私厨"],
    answer: profile.works,
  },
  {
    keywords: ["联系", "微信", "邮箱", "邮件", "电话", "contact", "email"],
    answer: "可以通过邮箱联系 Mike：1360237325@qq.com。",
  },
  {
    keywords: ["github", "主页", "仓库", "代码"],
    answer: "Mike 的 GitHub 主页是 https://github.com/For5634，后续项目和代码会继续往里面整理。",
  },
  {
    keywords: ["motto", "座右铭", "签名", "信条", "格言"],
    answer: `Mike 的 motto 是：“${profile.motto}” 这句话也挺符合他把注意力放回自己成长节奏的状态。`,
  },
  {
    keywords: ["方向", "研究", "擅长", "关心", "ai", "agent", "fcl"],
    answer: `Mike 目前关注 ${profile.strengths} 其中研究方向主要是联邦持续学习，开发上更关心 AI 工具怎么真正帮到科研和项目实践。`,
  },
  {
    keywords: ["技术栈", "tech", "stack", "spring", "java", "python", "node", "mysql", "deepseek"],
    answer: profile.stack,
  },
  {
    keywords: ["本科", "河南工业大学", "学习经历", "学校", "大学"],
    answer: `Mike 本科是河南工业大学计算机科学与技术专业，现在是西南交通大学研究生，当前主要关注联邦持续学习和 AI 工具辅助开发。`,
  },
  {
    keywords: ["兴趣", "爱好", "健身", "旅游", "摄影", "拍照", "照片", "生活", "特点", "性格", "游戏", "看剧", "听歌"],
    answer: profile.traits,
  },
  {
    keywords: ["你好", "hi", "hello", "哈喽"],
    answer: `你好，我是 ${profile.name} 的数字分身。你可以问我他的近况、作品、研究方向或者联系方式。`,
  },
];

const fallbackAnswers = [
  `这部分信息我还没有被提供得特别完整。我先帮你概括一下：Mike 是${profile.role}，本科是${profile.undergraduate}，目前关注联邦持续学习和 AI 工具辅助开发。`,
  "这个问题有点超出我现在掌握的 Mike 信息了。你可以换个问法，比如问他的近况、项目经历、擅长方向或联系方式。",
  "不太确定这部分细节。已知的是 Mike 做过黑马点评、苍穹外卖、AI 私厨，也在学习 AI 辅助开发范式（Vibe Coding）和联邦持续学习方向论文。",
];

const chatLog = document.querySelector("#chat-log");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const submitButton = chatForm.querySelector("button");
const suggestionButtons = document.querySelectorAll("[data-question]");
const chatHistory = [];

function normalizeQuestion(question) {
  return question.trim().toLowerCase();
}

function chooseReply(question) {
  const normalized = normalizeQuestion(question);
  const matchedReply = replies.find((reply) =>
    reply.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );

  if (matchedReply) {
    return matchedReply.answer;
  }

  const index = normalized.length % fallbackAnswers.length;
  return fallbackAnswers[index];
}

function appendMessage(author, text, className) {
  const message = document.createElement("article");
  const label = document.createElement("span");
  const content = document.createElement("p");

  message.className = `message ${className}`;
  label.textContent = author;
  content.textContent = text;

  message.append(label, content);
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;

  return message;
}

function setMessageText(message, text) {
  message.querySelector("p").textContent = text;
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendMessageText(message, text) {
  message.querySelector("p").textContent += text;
  chatLog.scrollTop = chatLog.scrollHeight;
}

function remember(role, content) {
  chatHistory.push({ role, content });

  if (chatHistory.length > 10) {
    chatHistory.splice(0, chatHistory.length - 10);
  }
}

function parseSseEvent(eventText) {
  let eventName = "message";
  const dataLines = [];

  eventText.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  });

  if (!dataLines.length) {
    return null;
  }

  return {
    eventName,
    data: JSON.parse(dataLines.join("\n")),
  };
}

async function requestModelReply(question, history, onDelta) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      history,
    }),
  });

  if (!response.body) {
    throw new Error("Streaming is not supported by this browser");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let serverFallback = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    const events = buffer.split("\n\n");
    buffer = events.pop();

    events.forEach((eventText) => {
      const parsedEvent = parseSseEvent(eventText);

      if (!parsedEvent) {
        return;
      }

      if (parsedEvent.eventName === "delta" && parsedEvent.data.text) {
        reply += parsedEvent.data.text;
        onDelta(parsedEvent.data.text);
      }

      if (parsedEvent.eventName === "error" && parsedEvent.data.reply) {
        serverFallback = parsedEvent.data.reply;
      }
    });
  }

  if (reply.trim()) {
    return reply.trim();
  }

  if (serverFallback) {
    onDelta(serverFallback);
    return serverFallback;
  }

  throw new Error("Empty model response");
}

function setChatBusy(isBusy) {
  chatInput.disabled = isBusy;
  submitButton.disabled = isBusy;
  suggestionButtons.forEach((button) => {
    button.disabled = isBusy;
  });
}

async function askDigitalTwin(question) {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return;
  }

  appendMessage("你", trimmedQuestion, "user-message");
  const previousHistory = chatHistory.slice();

  const pendingMessage = appendMessage("Mike 分身", "正在连接 DeepSeek V4...", "avatar-message loading-message");

  setChatBusy(true);
  try {
    let hasDelta = false;
    const reply = await requestModelReply(trimmedQuestion, previousHistory, (delta) => {
      if (!hasDelta) {
        setMessageText(pendingMessage, "");
        hasDelta = true;
      }

      appendMessageText(pendingMessage, delta);
    });

    if (!hasDelta) {
      setMessageText(pendingMessage, reply);
    }

    remember("user", trimmedQuestion);
    remember("assistant", reply);
  } catch (error) {
    const fallbackReply = chooseReply(trimmedQuestion);
    setMessageText(pendingMessage, fallbackReply);
    remember("user", trimmedQuestion);
    remember("assistant", fallbackReply);
  } finally {
    pendingMessage.classList.remove("loading-message");
    setChatBusy(false);
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  askDigitalTwin(chatInput.value);
  chatInput.value = "";
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question;
    chatInput.value = question;
    askDigitalTwin(question);
    chatInput.value = "";
  });
});
