import { SYSTEM_PROMPT } from './_systemPrompt.js';

const MODEL = 'claude-sonnet-5';
const ANTHROPIC_VERSION = '2023-06-01';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY nao configurada no servidor.' });
    return;
  }

  const appPassword = (process.env.APP_PASSWORD || '').trim();
  if (appPassword) {
    const providedPassword = req.headers['x-app-password'];
    if (providedPassword !== appPassword) {
      res.status(401).json({ error: 'Senha invalida ou expirada.' });
      return;
    }
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages e obrigatorio.' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
        ],
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Erro na API da Anthropic.' });
      return;
    }

    console.log('usage:', data.usage);

    const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
    const reply = textBlocks.join('\n') || 'Nao consegui responder agora, tenta de novo.';

    res.status(200).json({ reply });
  } catch (err) {
    console.error('chat handler error:', err);
    res.status(500).json({ error: `Falha ao conectar com a API da Anthropic: ${err.message}` });
  }
}
