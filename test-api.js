require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log('--- Testing NEW Gemini API Key ---');
    const key = process.env.GEMINI_API_KEY;
    console.log(`Using Key: ${key.substring(0, 7)}...`);

    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hi. Just a test.");
        console.log('✅ Success! Response:', result.response.text());
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testGemini();
