module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const prompt = body?.prompt || '';
  const memory = body?.memory || 'None';
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const groqKey = process.env.GROQ_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  // Adam Male Voice ID (Ultra-Realistic):
  const voiceId = 'pNInz6obpgDQGcFmaJgB';

  const systemPrompt = `You are Adheera, a personal male AI assistant modeled directly after JARVIS. 
Boss Memory: [${memory}]. 
Always address user as 'Boss'. Reply in short natural Hinglish using Roman alphabet (1-2 sentences). 
If Boss tells you a new fact to remember, append '[MEM: key=value]' at the end.`;

  let reply = null;

  // 1. LLM Generation (Groq -> OpenAI -> NVIDIA)
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          max_tokens: 80,
          temperature: 0.6
        })
      });
      const d = await r.json();
      if (r.ok && d?.choices?.[0]?.message?.content) reply = d.choices[0].message.content;
    } catch (_) {}
  }

  if (!reply && openAiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          max_tokens: 80
        })
      });
      const d = await r.json();
      if (r.ok && d?.choices?.[0]?.message?.content) reply = d.choices[0].message.content;
    } catch (_) {}
  }

  if (!reply && nvidiaKey) {
    try {
      const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nvidiaKey}` },
        body: JSON.stringify({
          model: 'meta/llama-3.2-90b-vision-instruct',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          max_tokens: 80
        })
      });
      const d = await r.json();
      if (r.ok && d?.choices?.[0]?.message?.content) reply = d.choices[0].message.content;
    } catch (_) {}
  }

  if (!reply) {
    return res.status(500).json({ error: 'AI generation failed' });
  }

  // 2. ElevenLabs Text-to-Speech in Cloud Server
  let audioBase64 = null;
  if (elevenKey) {
    try {
      // Memory tag ko aawaz se hata dein taki bot technical code na bole
      const cleanVoiceText = reply.replace(/\[MEM:\s*[^=]+=[^\]]+\]/g, '').trim();

      const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenKey.trim()
        },
        body: JSON.stringify({
          text: cleanVoiceText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 }
        })
      });

      if (ttsRes.ok) {
        const buf = await ttsRes.arrayBuffer();
        audioBase64 = Buffer.from(buf).toString('base64');
      }
    } catch (_) {}
  }

  // Server se text aur ElevenLabs ki aawaz ek sath return hogi!
  return res.status(200).json({
    reply: reply,
    audio: audioBase64
  });
};
