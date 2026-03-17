require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch'); // Ensure node-fetch is used if standard fetch isn't available in node version

async function testGemini() {
    console.log('--- Testing Gemini API ---');
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'your_gemini_api_key_here') {
        console.error('❌ GEMINI_API_KEY is missing or default in .env');
        return;
    }
    console.log(`Using Key: ${key.substring(0, 5)}...${key.substring(key.length - 4)}`);

    try {
        const genAI = new GoogleGenerativeAI(key);
        // We try to list models to see what's actually available
        // Note: listModels might not be available in all SDK versions or might require different auth
        console.log('Fetching models...');
        // In newer SDKs, this might be direct, but let's try a simple generation too
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log('✅ Gemini Response:', result.response.text());
    } catch (error) {
        console.error('❌ Gemini Error:', error.message);
        if (error.message.includes('404')) {
            console.log('Model not found. This might be a regional restriction or incorrect model name.');
        }
    }
}

async function testOpenRouter() {
    console.log('\n--- Testing OpenRouter API ---');
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
        console.error('❌ OPENROUTER_API_KEY is missing in .env');
        return;
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${key}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || "arcee-ai/trinity-mini:free",
                messages: [{ role: "user", content: "Hi" }]
            })
        });
        const data = await response.json();
        if (data.choices) {
            console.log('✅ OpenRouter Response:', data.choices[0].message.content);
        } else {
            console.error('❌ OpenRouter Error:', data);
        }
    } catch (error) {
        console.error('❌ OpenRouter Fetch Error:', error.message);
    }
}

testGemini();
testOpenRouter();
