export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, systemInstruction, imageBase64 } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Server API key missing in environment variables' });
  }

  // Build parts array (supports text + optional image payload for CTR simulator)
  const parts = [{ text: prompt }];
  if (imageBase64) {
    // Extract base64 data and mime type if uploaded as data url
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({
        inline_data: {
          mime_type: matches[1],
          data: matches[2]
        }
      });
    }
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: parts }],
          system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        })
      });

      const data = await response.json();

      // Automatically retry if overloaded or hitting quota limits (HTTP 429 or 503)
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries - 1) {
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }

      if (!response.ok) {
        const errorMsg = data.error?.message || "Gemini API error";
        if (response.status === 429 || errorMsg.includes("quota")) {
          throw new Error("You have exceeded your API quota limit. Please wait a moment or upgrade your Google AI Studio plan.");
        }
        throw new Error(errorMsg);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
      return res.status(200).json({ success: true, text });
      
    } catch (error) {
      if (attempt === maxRetries - 1) {
        return res.status(500).json({ success: false, error: error.message });
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
}
