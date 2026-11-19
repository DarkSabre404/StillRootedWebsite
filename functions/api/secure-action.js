// functions/api/secure-action.js  (Cloudflare Pages Function)
//
// The chatbot (js/chatbot.js) POSTs { system, messages, max_tokens }
// here. This function adds the secret Groq key (which never reaches the
// browser), calls Groq, and returns { reply }.
//
// Cloudflare environment variables:
//   StillRootedChatbotKey or GROQ_API_KEY - your Groq API key (required)
//   MODEL                  - optional, forces one specific Groq model

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Tried in order. If the first is rate-limited or unavailable on your free
// tier, the next one is used automatically.
const DEFAULT_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
const RETRY_STATUSES = [400, 404, 429, 500, 503];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

// Dashboard values are often pasted with spaces, newlines or quotes.
const cleanValue = (value) => String(value || '').trim().replace(/^["']|["']$/g, '').trim();
const redactSecret = (value, secret) => {
  const text = String(value || '');
  return secret ? text.split(secret).join('[REDACTED]') : text;
};
const describeError = (error, secret) => ({
  name: error && error.name ? redactSecret(error.name, secret) : 'Error',
  message: redactSecret(error && error.message ? error.message : error, secret),
  stack: error && error.stack ? redactSecret(error.stack, secret) : undefined
});

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: 'Request body must be valid JSON' }, 400);
  }

  if (!body || !Array.isArray(body.messages)) {
    return json({ error: 'Request must include a messages array' }, 400);
  }

  const key =
    cleanValue(env && env.StillRootedChatbotKey) ||
    cleanValue(env && env.GROQ_API_KEY);
  if (!key) {
    console.error('[secure-action] Groq API key is missing. Configure StillRootedChatbotKey or GROQ_API_KEY in Cloudflare Pages.');
    return json({ error: 'Set StillRootedChatbotKey or GROQ_API_KEY in Cloudflare Pages' }, 500);
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

  const forcedModel = cleanValue(env && env.MODEL);
  const models = forcedModel ? [forcedModel] : DEFAULT_MODELS;

  let lastStatus = 0;
  let lastDetail = '';

  for (const model of models) {
    let upstream;
    try {
      upstream = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: maxTokens,
          temperature: 0.4,
          messages: [{ role: 'system', content: system }, ...messages]
        })
      });
    } catch (error) {
      console.error('[secure-action] Failed to reach Groq.', {
        model,
        error: describeError(error, key)
      });
      lastStatus = 502;
      lastDetail = 'Unable to reach Groq API';
      break;
    }

    if (upstream.ok) {
      let data;
      try {
        data = await upstream.json();
      } catch (error) {
        console.error('[secure-action] Groq returned an invalid JSON response.', {
          model,
          error: describeError(error, key)
        });
        lastStatus = 502;
        lastDetail = 'Groq returned an invalid response';
        continue;
      }

      const choices = data && data.choices;
      const reply =
        (choices && choices[0] && choices[0].message && choices[0].message.content) || '';
      if (String(reply).trim()) return json({ reply: String(reply).trim() });
      lastStatus = 502;
      lastDetail = 'Model returned an empty answer';
      console.error('[secure-action] Groq returned a successful response with no reply text.', { model });
      continue;
    }

    lastStatus = upstream.status;
    try {
      lastDetail = redactSecret((await upstream.text()).slice(0, 300), key);
    } catch (error) {
      lastDetail = '';
      console.error('[secure-action] Could not read Groq error response body.', {
        model,
        status: upstream.status,
        error: describeError(error, key)
      });
    }
    console.error('[secure-action] Groq returned an error response.', {
      model,
      status: upstream.status,
      statusText: upstream.statusText,
      detail: lastDetail
    });

    // A bad key will fail on every model, so do not retry that.
    if (!RETRY_STATUSES.includes(lastStatus)) break;
  }

  // Non-2xx responses cause chatbot.js to use its built-in rule-based model.
  return json({ error: `Groq API returned ${lastStatus}`, detail: lastDetail }, 502);
}
