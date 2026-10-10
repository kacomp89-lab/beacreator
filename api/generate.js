export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, systemInstruction } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key missing in environment variables' });
  }

  try {
    // Updated to gemini-3.8-flash as requested by the API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini API error");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    return res.status(200).json({ success: true, text });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
