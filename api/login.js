export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const appPassword = (process.env.APP_PASSWORD || '').trim();
  if (!appPassword) {
    res.status(500).json({ error: 'APP_PASSWORD nao configurada no servidor.' });
    return;
  }

  const { password } = req.body || {};
  if (password === appPassword) {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(401).json({ ok: false, error: 'Senha incorreta.' });
}
