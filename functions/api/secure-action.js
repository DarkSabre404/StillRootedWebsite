// functions/api/secure-action.js  (Cloudflare Pages Function)
//
// The chatbot (js/chatbot.js) POSTs { system, messages, message, max_tokens }
// here. This function adds the secret key (which never reaches the browser),
// calls the model, and returns { reply }.
//
// Secrets are read from Cloudflare environment variables:
//   StillRootedChatbotKey  - the chatbot's API key (required)
//   testKey                - kept for your other uses, not touched here
//   MODEL                  - optional, overrides the default model below

const DEFAULT_MODEL = 'claude-haiku-5-5';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // Requests without chat messages keep the original behaviour.
    if (!body || !Array.isArray(body.messages)) {
      return json({ success: true, message: 'Secure action processed successfully!' });
    }

    const chatbotKey = env.StillRootedChatbotKey;
    if (!chatbotKey) return json({ error: 'Environment variable StillRootedChatbotKey is not set for this deployment' }, 500);

    // Never trust the browser: validate and clamp everything.
    const messages = body.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return json({ error: 'Invalid request' }, 400);
    }

    const system = typeof body.system === 'string' ? body.system.slice(0, 12000) : '';
    const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 400, 50), 500);

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chatbotKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.MODEL || DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages
      })
    });

    if (!upstream.ok) {
      // Safe to pass on: describes the problem (e.g. invalid key, unknown model), never the key.
      let detail = '';
      try { detail = (await upstream.text()).slice(0, 300); } catch (e) { /* ignore */ }
      console.error('Model API error', upstream.status, detail);
      return json({ error: 'Model API returned ' + upstream.status, detail }, 502);
    }

    const data = await upstream.json();
    const reply = (data.content || []).map((block) => block.text || '').join('').trim();
    return json({ reply });
  } catch (err) {
    return json({ error: 'Invalid request or unauthorized' }, 400);
  }
}