module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Safe Body Parsing
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  const prompt = body?.prompt || '';
  const memory = body?.memory || 'None';

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `You are Adheera, a personal male AI assistant modeled directly after JARVIS. 
Boss Memory: [${memory}]. 
Always address user as 'Boss'. Reply in short natural Hinglish using Roman alphabet (1-2 sentences). 
If Boss tells you a new fact to remember, append '[MEM: key=value]' at the end.`;

  let errors = [];

  // 1. Core: Groq (Super Fast 0.2s)
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        })
      });
      const data = await r.json();
      if (r.ok && data?.choices?.[0]?.message?.content) {
        return res.status(200).json({ reply: data.choices[0].message.content, provider: 'groq' });
      } else {
        errors.push(`Groq: ${r.status}`);
      }
    } catch (e) {
      errors.push(`Groq error: ${e.message}`);
    }
  } else {
    errors.push('GROQ_API_KEY missing');
  }

  // 2. Core: OpenAI Fallback
  if (openAiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
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
        })
      });
      const data = await r.json();
      if (r.ok && data?.choices?.[0]?.message?.content) {
        return res.status(200).json({ reply: data.choices[0].message.content, provider: 'openai' });
      } else {
        errors.push(`OpenAI: ${r.status}`);
      }
    } catch (e) {
      errors.push(`OpenAI error: ${e.message}`);
    }
  }

  // 3. Core: NVIDIA Fallback
  if (nvidiaKey) {
    try {
      const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
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
        })
      });
      const data = await r.json();
      if (r.ok && data?.choices?.[0]?.message?.content) {
        return res.status(200).json({ reply: data.choices[0].message.content, provider: 'nvidia' });
      } else {
        errors.push(`NVIDIA: ${r.status}`);
      }
    } catch (e) {
      errors.push(`NVIDIA error: ${e.message}`);
    }
  }

  // 4. Core: Google Gemini Fallback
  if (geminiKey) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\nUser: ${prompt}` }] }]
        })
      });
      const data = await r.json();
      if (r.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(200).json({ reply: data.candidates[0].content.parts[0].text, provider: 'gemini' });
      } else {
        errors.push(`Gemini: ${r.status}`);
      }
    } catch (e) {
      errors.push(`Gemini error: ${e.message}`);
    }
  }

  return res.status(500).json({
    error: 'All AI cores failed',
    details: errors
  });
};
