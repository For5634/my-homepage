# Mike Homepage

## Configure DeepSeek

Create a local `.env` file in this folder:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
```

Then start the site:

```powershell
npm.cmd start
```

Do not commit `.env`; keep API keys private. If a key has been shared in chat or screenshots, rotate it in the DeepSeek console.

## Deploy to Netlify

Netlify serves `public/` as the static site and runs the streamed chat endpoint from `netlify/functions/chat.mjs` at `/api/chat`.

Configure these environment variables in Netlify:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
```
