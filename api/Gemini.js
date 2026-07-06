export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel settings.' });
    }

    const { action, prompt, text } = req.body;

    try {
        // --- 1. HEROES CHAT LOGIC ---
        if (action === 'chat') {
            const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!modelsRes.ok) {
                if (modelsRes.status === 429) return res.status(429).json({ error: 'Quota Exceeded' });
                return res.status(modelsRes.status).json({ error: 'Failed to fetch models list.' });
            }
            const modelsData = await modelsRes.json();
            
            const validModelObj = modelsData.models.find(m => 
                m.supportedGenerationMethods.includes("generateContent") && 
                !m.name.includes("tts") && !m.name.includes("embedding") && m.name.includes("gemini")
            );

            if (!validModelObj) return res.status(500).json({ error: "No text models enabled." });

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/${validModelObj.name}:generateContent?key=${apiKey}`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: prompt })
            });
            
            const data = await response.json();
            return res.status(response.status).json(data);
        } 
        
        // --- 2. POETRY TTS LOGIC ---
        else if (action === 'tts') {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
                },
                model: "gemini-2.5-flash-preview-tts" // <-- This was missing in the previous backend version!
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return res.status(response.status).json({ error: data.error?.message || 'Gemini TTS request failed' });
            }

            return res.status(200).json(data);
        }
        
        else {
            return res.status(400).json({ error: "Invalid action" });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}