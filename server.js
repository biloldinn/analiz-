const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDn2SUrDcDUjyUKd8OQqlyf6Tzb663FcU0');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// --- TRADING KNOWLEDGE BASE (from books) ---
const TRADING_KNOWLEDGE = `
=== TRADING KNOWLEDGE BASE (DFX STRATEGY SERIES) ===

## SMC (Smart Money Concepts) - @demond_fx
- **Order Blocks**: Institutional zones where big money entered. Bullish OB = last bearish candle before strong move up. Bearish OB = last bullish candle before move down.
- **Fair Value Gaps (FVG/Imbalance)**: 3-candle pattern where middle candle leaves a gap. Price MUST return to fill the gap.
- **Liquidity**: Pools of stops above/below swing highs and lows. Smart money sweeps liquidity before real move.
- **CHOCH (Change of Character)**: First break of structure in opposite direction after liquidity sweep. Signals potential reversal.
- **BOS (Break of Structure)**: Continuation signal. Price breaks a previous high (bullish) or low (bearish).
- **Premium/Discount**: Above 50% Fibonacci = Premium (sell zone). Below 50% = Discount (buy zone).

## SNR (Support and Resistance)
- **Strong levels**: Multiple touches, longer timeframe, sharp moves from them.
- **Flip zones**: Old support becomes resistance and vice versa.
- **Round numbers**: Psychological levels (1.1000, 1.2000) act as strong S/R.

## Wyckoff Method
- **Accumulation**: Smart money buying in range. Key phases: PS, SC, AR, ST, Spring, SOS.
- **Distribution**: Smart money selling. Opposite of accumulation.
- **Spring**: False break below support to trigger stops before markup.
- **Upthrust**: False break above resistance before markdown.
- **VSA (Volume Spread Analysis)**: High volume + narrow spread = absorption. Low volume + wide spread = weakness.

## Fibonacci
- Key levels: 0.618, 0.65, 0.705, 0.79 (Golden Pocket)
- Entry on retracement to 0.618-0.705 after BOS
- OTE (Optimal Trade Entry): 0.618-0.79 retracement zone

## Elliott Wave
- **Impulse**: 5 waves in trend direction (1-2-3-4-5). Wave 3 always longest.
- **Correction**: 3 waves against trend (A-B-C).
- **Rules**: Wave 2 never retraces >100% of Wave 1. Wave 3 never shortest. Wave 4 never overlaps Wave 1.
- **Best entries**: Wave 2 (buy dip), Wave 4, Wave B (counter-trend).

## MO3 (Manipulation, Optimization, Expansion) - DFX
- **Manipulation phase**: Price sweeps daily high/low to trap traders.
- **Optimization (OP)**: Price returns to OB or FVG - optimal entry zone.
- **Expansion**: Real directional move begins from OP.
- **Key times**: 02:00-05:00 (Asian manipulation), 08:00-10:00 (London sweep), 14:00-16:00 (NY sweep).

## CHOCH Pattern - @demond_fx
- Identify trending market → Wait for liquidity sweep → Look for CHOCH (first opposite BOS) → Enter on retest.
- Confirmation: RSI divergence + CHOCH = high probability setup.

## Quasimodo Pattern (QM)
- Advanced reversal pattern. Left shoulder, head, right shoulder (but right shoulder lower than left for bearish QM).
- Entry: Break and retest of "neck" level.

## SND Pattern (Supply and Demand) - DFX
- **Fresh zones**: First time price reaches a supply/demand zone.
- **Zone strength**: Sharp move away = strong zone. Gradual = weak.
- **Best entries**: Fresh zones + confluence with session high/low sweep.

## Bozor Strukturasi (Market Structure)
- Bullish: Higher Highs (HH) + Higher Lows (HL)
- Bearish: Lower Highs (LH) + Lower Lows (LL)
- Range: Equal highs and lows - look for breakout.

## Bank Manipulation (Candle Patterns)
- **Hammer/Pin Bar**: Long wick = rejection of price. Buy if bullish pin at support.
- **Engulfing**: Completely engulfs previous candle. Strong reversal signal.
- **Doji**: Indecision. Followed by expansion.
- **Morning/Evening Star**: 3-candle reversal patterns.
- **Marubozu**: Full-body candle, no wicks. Very strong momentum.

## Risk Management
- Risk per trade: 1-2% of account.
- RRR minimum: 1:2 (better 1:3 or 1:5).
- Never move SL to breakeven too early.
- Trailing stop: Move to first swing after price moves 1R in profit.

## Session Times (UTC+5)
- Asian session: 02:00 - 11:00
- London session: 10:00 - 19:00
- New York session: 15:00 - 24:00
- Kill zones (best entries): 08:00-10:00, 13:00-15:00, 19:00-21:00

## Entry Checklist
1. Identify market structure (trend or range)
2. Mark key liquidity pools (swing highs/lows)
3. Wait for liquidity sweep (fakeout)
4. Look for CHOCH or strong rejection
5. Enter at OB/FVG/Supply-Demand zone
6. Set SL beyond liquidity pool
7. Take profit at next liquidity zone
`;

// --- AI CHART ANALYSIS ENDPOINT ---
app.post('/api/analyze', async (req, res) => {
    const { imageBase64, timeframe, pair, additionalContext } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Rasm kerak!' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `SIZ PROFESSIONAL TRADING ANALISTISIZ. Quyidagi barcha bilimlar sizning KNOWLEDGE BASE ingiz:

${TRADING_KNOWLEDGE}

TAHLIL QILISH UCHUN MA'LUMOTLAR:
- Juftlik: ${pair || 'Noma\'lum'}
- Vaqt oralig'i: ${timeframe || 'Noma\'lum'}
- Qo'shimcha: ${additionalContext || 'Yo\'q'}

VAZIFANGIZ: Foydalanuvchi tashlagan BOZOR SKRINSHOTINI to'liq va professional tahlil qiling.

TAHLIL FORMATI (QUYIDAGI TARTIBDA):
## 📊 BOZOR STRUKTURASI
[Trend yo'nalishi: Bullish/Bearish/Range. Muhim yuqori-pastlar]

## 🕯️ SHAMLAR TAHLILI
[Ko'rinayotgan shamlar naqshlari. Eng so'nggi muhim shamlar]

## 🏦 SMC TAHLILI (Smart Money Concepts)
[Order Blocklar, FVGlar, Likvidlik zonalari]

## 📍 MUHIM ZONALAR
[Qo'llab-quvvatlash: ..., Qarshilik: ...]

## 🎯 TUZILGAN STRATEGIYA
Strategiya: [SMC/Wyckoff/Elliott va h.k.]
Signal: 🟢 SOTIB OL / 🔴 SOT / 🟡 KUTISH
Kirish: [narx]
To'xtatish: [narx]  
Maqsad 1: [narx]
Maqsad 2: [narx]
Risk/Reward: [1:X]

## ⚠️ XAVF BAHOLASH
Ishonch darajasi: [Yuqori/O'rta/Past] %
Sababi: [...]

## 💡 TAVSIYA
[Qisqa, aniq tavsiya]

FAQAT O'ZBEK TILIDA JAVOB BERING. Professional, aniq va qisqa bo'lsin.`;

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: 'image/jpeg'
                }
            },
            prompt
        ]);

        const analysis = result.response.text();
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('AI tahlil xatosi:', error);
        res.status(500).json({ success: false, error: 'AI tahlilida xatolik: ' + error.message });
    }
});

// --- MARKET DATA PROXY ---
app.get('/api/market/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Bozor ma\'lumotlari olishda xato' });
    }
});

// --- QUICK AI CHAT ---
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const prompt = `${TRADING_KNOWLEDGE}\n\nFOYDALANUVCHI SAVOLI: "${message}"\n\nO'zbek tilida qisqa, professional javob bering. Savol treding haqida bo'lsa bilimlaringizdan foydalaning.`;
    try {
        const result = await model.generateContent(prompt);
        res.json({ success: true, response: result.response.text() });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Chat xatosi' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Trading AI Server: http://localhost:${PORT}`);
});
