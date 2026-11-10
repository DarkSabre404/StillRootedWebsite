// functions/api/secure-action.js  (Cloudflare Pages Function)
//
// The chatbot (js/chatbot.js) POSTs { system, messages, message, max_tokens }
// here. This function adds the secret Groq key (which never reaches the
// browser), calls Groq, and returns { reply }.
//
// Cloudflare environment variables:
//   StillRootedChatbotKey  - your Groq API key, starts with "gsk_" (required)
//   testKey                - kept for your other uses, not touched here
//   MODEL                  - optional, forces one specific Groq model

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Tried in order. If the first is rate-limited or unavailable on your free
// tier, the next one is used automatically.
const DEFAULT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const RETRY_STATUSES = [400, 404, 429, 500, 503];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

// Dashboard values are often pasted with spaces, newlines or quotes.
const cleanValue = (value) => String(value || '').trim().replace(/^["']|["']$/g, '').trim();

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // Requests without chat messages keep the original behaviour.
    if (!body || !Array.isArray(body.messages)) {
      return json({ success: true, message: 'Secure action processed successfully!' });
    }

    const key = cleanValue(env.StillRootedChatbotKey);
    if (!key) {
      return json({ error: 'Environment variable StillRootedChatbotKey is not set for this deployment' }, 500);
    }

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

    const forcedModel = cleanValue(env.MODEL);
    const models = forcedModel ? [forcedModel] : DEFAULT_MODELS;

    let lastStatus = 0;
    let lastDetail = '';

    for (const model of models) {
      const upstream = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: maxTokens,
          temperature: 0.4,
          messages: [{ role: 'system', content: system }, ...messages]
        })
      });

      if (upstream.ok) {
        const data = await upstream.json();
        const reply =
          (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        if (String(reply).trim()) return json({ reply: String(reply).trim() });
        lastStatus = 502;
        lastDetail = 'Model returned an empty answer';
        continue;
      }

      lastStatus = upstream.status;
      try { lastDetail = (await upstream.text()).slice(0, 300); } catch (e) { lastDetail = ''; }
      console.error('Groq error', model, lastStatus, lastDetail);

      // A bad key will fail on every model, so do not retry that.
      if (!RETRY_STATUSES.includes(lastStatus)) break;
    }

    // The detail describes the problem (e.g. invalid key); it never contains the key.
    return json({ error: `Groq API returned ${lastStatus}`, detail: lastDetail }, 502);
  } catch (err) {
    return json({ error: 'Invalid request or unauthorized' }, 400);
  }
}