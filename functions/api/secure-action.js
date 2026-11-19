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
const MAX_USER_MESSAGE_LENGTH = 500;
const MAX_REPLY_TOKENS = 300;
const RESPONSE_CACHE_TTL = 86400;
const REPEAT_QUESTION_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'could', 'do', 'does', 'for', 'how', 'i',
  'is', 'it', 'me', 'my', 'of', 'our', 'please', 'tell', 'the', 'to', 'us',
  'what', 'when', 'where', 'which', 'who', 'would', 'you', 'your'
]);

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
const normalizeQuestion = (question) =>
  String(question || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
const questionTokens = (question) =>
  new Set(normalizeQuestion(question).split(' ').filter((word) => word && !REPEAT_QUESTION_STOP_WORDS.has(word)));
const isSimilarQuestion = (first, second) => {
  const normalizedFirst = normalizeQuestion(first);
  const normalizedSecond = normalizeQuestion(second);
  if (!normalizedFirst || !normalizedSecond) return false;
  if (normalizedFirst === normalizedSecond) return true;

  const firstTokens = questionTokens(normalizedFirst);
  const secondTokens = questionTokens(normalizedSecond);
  let overlap = 0;
  firstTokens.forEach((word) => {
    if (secondTokens.has(word)) overlap += 1;
  });

  if (firstTokens.size === 1 && secondTokens.size === 1 && overlap === 1) return true;
  const union = firstTokens.size + secondTokens.size - overlap;
  return overlap >= 2 && union > 0 && overlap / union >= 0.75;
};

const hashCacheKey = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

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

  // Never trust the browser: validate and clamp everything.
  const messages = body.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, m.role === 'user' ? MAX_USER_MESSAGE_LENGTH : 1500)
    }));

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return json({ error: 'Invalid request' }, 400);
  }

  const system = typeof body.system === 'string' ? body.system.slice(0, 12000) : '';
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 200, 50), MAX_REPLY_TOKENS);

  const forcedModel = cleanValue(env && env.MODEL);
  const models = forcedModel ? [forcedModel] : DEFAULT_MODELS;
  const latestQuestion = messages[messages.length - 1].content;

  for (let index = 0; index < messages.length - 1; index += 1) {
    const previousQuestion = messages[index];
    const previousAnswer = messages[index + 1];
    if (
      previousQuestion.role === 'user' &&
      previousAnswer.role === 'assistant' &&
      previousAnswer.content.trim() &&
      isSimilarQuestion(previousQuestion.content, latestQuestion)
    ) {
      return json({ reply: previousAnswer.content });
    }
  }

  // Only cache first-turn replies; answers based on prior conversation context
  // must not be reused across different visitors or sessions.
  let responseCache = null;
  let cacheRequest = null;
  if (
    messages.length === 1 &&
    normalizeQuestion(latestQuestion) &&
    typeof caches !== 'undefined' &&
    caches.default
  ) {
    try {
      responseCache = caches.default;
      const cacheKey = await hashCacheKey(JSON.stringify({
        question: normalizeQuestion(latestQuestion),
        system,
        models,
        maxTokens
      }));
      const cacheUrl = new URL(request.url);
      cacheUrl.pathname = `/__ashbot-cache/${cacheKey}`;
      cacheUrl.search = '';
      cacheRequest = new Request(cacheUrl.toString());

      const cachedResponse = await responseCache.match(cacheRequest);
      if (cachedResponse) {
        const cached = await cachedResponse.json();
        if (cached && typeof cached.reply === 'string' && cached.reply.trim()) {
          return json({ reply: cached.reply });
        }
      }
    } catch (error) {
      responseCache = null;
      cacheRequest = null;
      console.warn('[secure-action] Could not read the response cache.', describeError(error));
    }
  }

  const key =
    cleanValue(env && env.StillRootedChatbotKey) ||
    cleanValue(env && env.GROQ_API_KEY);
  if (!key) {
    console.error('[secure-action] Groq API key is missing. Configure StillRootedChatbotKey or GROQ_API_KEY in Cloudflare Pages.');
    return json({ error: 'Set StillRootedChatbotKey or GROQ_API_KEY in Cloudflare Pages' }, 500);
  }

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
      if (String(reply).trim()) {
        const cleanReply = String(reply).trim();
        if (responseCache && cacheRequest) {
          try {
            await responseCache.put(
              cacheRequest,
              new Response(JSON.stringify({ reply: cleanReply }), {
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': `public, max-age=${RESPONSE_CACHE_TTL}`
                }
              })
            );
          } catch (error) {
            console.warn('[secure-action] Could not write the response cache.', describeError(error));
          }
        }
        return json({ reply: cleanReply });
      }
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
