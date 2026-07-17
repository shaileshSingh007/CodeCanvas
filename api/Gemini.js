export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Securely grab the API key from Vercel Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel settings.' });
    }

    const { action, prompt, text, voice, image } = req.body;

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
            
            const selectedVoice = (voice === "Puck") ? "Puck" : "Kore";

            const payload = {
                contents: [{ parts: [{ text: text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: { 
                        voiceConfig: { 
                            prebuiltVoiceConfig: { voiceName: selectedVoice } 
                        } 
                    }
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            return res.status(response.status).json(data);
        }

        // --- 3. TWIK THE AI VISION LOGIC ---
        else if (action === 'vision') {
    // Fetch list of available models
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelsData = await modelsRes.json();
    
    // Find a model that supports generateContent and can handle images
    // (most "gemini-*" flash or pro models do)
    const visionModel = modelsData.models.find(m =>
        m.supportedGenerationMethods.includes("generateContent") &&
        m.name.includes("gemini") &&
        (m.name.includes("flash") || m.name.includes("pro")) // optional filter
    );
    
    if (!visionModel) return res.status(500).json({ error: "No vision model available." });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${visionModel.name}:generateContent?key=${apiKey}`;
    
    
}
            const payload = {
                contents: [{ 
                    role: "user", 
                    parts: [
                        { text: prompt }, 
                        { inlineData: { mimeType: "image/jpeg", data: image } }
                    ] 
                }],
                generationConfig: { responseMimeType: "application/json" }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            return res.status(response.status).json(data);
        }
        
        else {
            return res.status(400).json({ error: "Invalid action" });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

