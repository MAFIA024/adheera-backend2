const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS Headers (App se connection allow karne ke liye)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, memory } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  const systemPrompt = `You are Adheera, an autonomous male AI Agent modeled directly after JARVIS. 
Boss Memory: [${memory || 'None'}]. 
Reply in crisp, natural Hinglish (Roman alphabet, 1-2 short sentences). Address user as 'Boss'. 
If user tells a new fact to remember, append '[MEM: key=value]' at the end.`;

  // 1. Core 1: Groq (Super Fast 0.2s)
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 80,
          temperature: 0.6
        }),
        timeout: 3000
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices[0].message.content;
        return res.status(200).json({ reply, provider: 'groq' });
      }
    } catch (_) {}
  }

  // 2. Core 2: OpenAI Fallback
  if (openAiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 80
        }),
        timeout: 3000
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices[0].message.content;
        return res.status(200).json({ reply, provider: 'openai' });
      }
    } catch (_) {}
  }

  // 3. Core 3: NVIDIA Fallback
  if (nvidiaKey) {
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nvidiaKey}`
        },
        body: JSON.stringify({
          model: 'meta/llama-3.2-90b-vision-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 80
        }),
        timeout: 3000
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices[0].message.content;
        return res.status(200).json({ reply, provider: 'nvidia' });
      }
    } catch (_) {}
  }

  return res.status(500).json({ error: 'All AI cores unavailable' });
};
