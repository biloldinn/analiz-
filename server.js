const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');

require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Client Init with Rotation
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
].filter(Boolean);

let currentKeyIndex = 0;
const MODEL_NAME = "gemini-2.0-flash";

// Helper to get genAI instance
function getGenAI() {
    return new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
}

// Function to call Gemini with automatic fallback/retry on 429
async function callGemini(prompt, isVision = false, imageBase64 = null) {
    let lastError = null;

    // Try both keys if needed
    for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
        try {
            const genAI = getGenAI();
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            let result;
            if (isVision && imageBase64) {
                const parts = [
                    { text: prompt },
                    { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } }
                ];
                result = await model.generateContent(parts);
            } else {
                result = await model.generateContent(prompt);
            }

            const response = await result.response;
            return { success: true, text: response.text() };
        } catch (error) {
            console.error(`Gemini Error on Key ${currentKeyIndex + 1}:`, error.message);
            lastError = error;

            // If 429 (Quota Exceeded), rotate key and try again
            if (error.message.includes('429') || error.message.includes('Quota')) {
                currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                console.log(`Key rotated! Now using Key ${currentKeyIndex + 1}. Waiting 2s...`);
                // Wait 2 seconds before retry to let the quota breathe
                await new Promise(r => setTimeout(r, 2000));
                continue; // Next iteration tries the next key
            }

            // If other error (e.g. 404, 500), just break and return failure
            break;
        }
    }

    // Final Fallback to OpenRouter if all Gemini keys fail
    console.log("⚠️ Barcha Gemini kalitlari band. OpenRouter (Zaxira) ishga tushyapti...");
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.0-flash-001",
                "messages": [
                    {
                        "role": "user", "content": isVision && imageBase64 ? [
                            { "type": "text", "text": prompt },
                            { "type": "image_url", "image_url": { "url": imageBase64 } }
                        ] : prompt
                    }
                ]
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            return { success: true, text: data.choices[0].message.content };
        } else {
            console.error("OpenRouter Response:", JSON.stringify(data));
            return { success: false, error: "OpenRouter Zaxira ishlamadi: " + (data.error?.message || "Noma'lum xato") };
        }
    } catch (err) {
        console.error("OpenRouter Error:", err.message);
        return { success: false, error: "AI Zaxirasi xatosi: " + err.message };
    }
}

// ===================================================
// PDF BOOKS LOADER
// ===================================================
const BOOKS_DIR = path.join(__dirname, 'books');
let BOOK_KNOWLEDGE = "";
let loadedBooksNames = [];

async function loadBooks() {
    try {
        if (!fs.existsSync(BOOKS_DIR)) fs.mkdirSync(BOOKS_DIR);
        const files = fs.readdirSync(BOOKS_DIR).filter(f => f.endsWith('.pdf'));

        for (const file of files) {
            const dataBuffer = fs.readFileSync(path.join(BOOKS_DIR, file));
            const data = await pdf(dataBuffer);
            BOOK_KNOWLEDGE += `\n--- KITOB: ${file} ---\n${data.text}\n`;
            loadedBooksNames.push(file);
        }

        // TURBO MODE: Truncate to 40k to ensure instant AI response.
        if (BOOK_KNOWLEDGE.length > 40000) {
            console.log(`⚡ Turbo Mode: Bilimlar bazasi qisqartirildi (${BOOK_KNOWLEDGE.length} -> 40000).`);
            BOOK_KNOWLEDGE = BOOK_KNOWLEDGE.substring(0, 40000) + "\n[...]";
        }

        console.log(`✅ ${loadedBooksNames.length} ta kitob tayyor!`);
    } catch (error) {
        console.error('PDF o‘qishda xato:', error);
    }
}

loadBooks();

// ===================================================
// API ENDPOINTS
// ===================================================

app.get('/api/books', (req, res) => {
    res.json({ success: true, books: loadedBooksNames, loaded: loadedBooksNames.length });
});

// 1. Analyze Chart (Groq Vision + Books Integration)
app.post('/api/analyze', async (req, res) => {
    const { imageBase64, pair, timeframe, additionalContext } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Rasm topilmadi!' });
    }

    const mainPrompt = `
        SEN PROFESSIONAL DFX (DEMOND FX) EKSPERT TREYDERMISAN. 
        Sening maqsading - bozorni chirurgik aniqlikda tahlil qilish.
        Sening ixtiyoringda ushbu kitoblar va bilimlar bazasi bor:
        ${BOOK_KNOWLEDGE}
        
        TOPHIRIQ:
        Rasmdagi ${pair} grafigini ${timeframe} intervalida professional tahlil qil.
        
        TAHLIL QOIDALARI:
        1. **FIBONACCI:** Eng oxirgi impulsli harakatni aniqla. 0.5 (Equilibrium), 0.618 (Golden Pocket) va 0.786 (OTE) darajalarini ko'rsat.
        2. **LIQUIDITY & SL:** Likvidlik (liquidity hunt) hududlarini aniqla. Stop-Loss (SL) ni aynan qayerga qo'yishni ko'rsat.
        3. **TARGETS:** Take-Profit (TP) uchun eng yaqin kutilayotgan likvidlik zonalarini belgilang.
        4. **DFX STRATEGY:** Yuqoridagi kitoblardan (SMC, Wyckoff, Yapon shamlari) foydalanib bozorni o'qi.
        
        NATIJANI QUYIDAGI FORMATDA BER (MAKSIMAL ANIQ):
        ## 📊 FIBONACCI VA BOZOR HOLATI
        (Impuls, darajalar va hozirgi holat)
        
        ## 🕯️ SHAM NAQSHLARI VA SMC
        (Kitoblarga asoslangan sham va bloklar tahlili)
        
        ## 🎯 SIGNAL VA XAVF BOSHQARUVI
        - **SIGNAL:** 🟢 BUY / 🔴 SELL / 🟡 WAIT
        - **STOP-LOSS (SL):** (Aniq daraja)
        - **TAKE-PROFIT (TP):** (Kutilayotgan TP)
        
        Muhim: Faqat o'zbek tilida qisqa va faktlarga asoslangan javob ber.
    `;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "llama-3.2-11b-vision-preview",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            { "type": "text", "text": mainPrompt },
                            { "type": "image_url", "image_url": { "url": imageBase64 } }
                        ]
                    }
                ],
                "max_tokens": 1024
            })
        });

        const data = await response.json();
        if (data.choices && data.choices[0]) {
            res.json({ success: true, analysis: data.choices[0].message.content });
        } else {
            console.error("Groq Analysis Failed:", JSON.stringify(data));
            res.json({ success: false, error: "Groq xatosi: " + (data.error?.message || "Noma'lum xato!") });
        }
    } catch (e) {
        console.error("Groq Analysis Error:", e);
        res.json({ success: false, error: "Groq ulanish xatosi: " + e.message });
    }
});

// 2. AI Chat (Now Powered by GROQ for Instaspeed!)
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    const chatPrompt = `
        SEN TRADING BO'YICHA AI EKSPERTMISAN. 
        Sening bilimlaring @demond_fx va quyidagi 14 ta kitob metodikasiga asoslangan:
        
        BILIMLAR BAZASI:
        ${BOOK_KNOWLEDGE}
        
        SAVOL: "${message}"
        
        Topshiriq: Ushbu savolga faqat yuqoridagi bilimlar bazasiga asoslanib javob ber. Agar kitoblarda javob bo'lmasa, umumiy trading bilimingdan foydalan, lekin muallifning (@demond_fx) metodikasiga rioya qil. Faqat o'zbek tilida javob ber.
    `;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "llama-3.3-70b-specdec",
                "messages": [{ "role": "user", "content": chatPrompt }],
                "max_tokens": 1024
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            res.json({ success: true, response: data.choices[0].message.content });
        } else {
            console.log("Groq Fail, Falling back to Gemini Chat...");
            const aiRes = await callGemini(chatPrompt);
            res.json({ success: aiRes.success, response: aiRes.text || aiRes.error });
        }
    } catch (e) {
        console.error("Groq Chat Error:", e);
        const aiRes = await callGemini(chatPrompt);
        res.json({ success: aiRes.success, response: aiRes.text || aiRes.error });
    }
});

// ===================================================
// START SERVER
// ===================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server http://localhost:${PORT} da ishga tushdi!`);
});

// Binanace data - used by client for charts
app.get('/api/market/:symbol', async (req, res) => {
    try {
        const resEnv = await fetch(`https://api.binance.com/api/v3/klines?symbol=${req.params.symbol}&interval=1h&limit=100`);
        const data = await resEnv.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Data error' });
    }
});
