// ===========================
// TRADING AI - Main App Logic
// ===========================

const API_BASE = window.location.origin;

// Fetch loaded books from server
async function fetchBooksStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/books`);
        const data = await res.json();
        if (data.success && data.loaded > 0) {
            const booksEl = document.getElementById('booksStatus');
            if (booksEl) {
                booksEl.innerHTML = `✅ <strong>${data.loaded} ta kitob AI ga integratsiya qilindi:</strong><br><span style="color:var(--text-secondary)">${data.books.map(b => '• ' + b).join('<br>')}</span>`;
            }
            const headerBadge = document.getElementById('booksBadge');
            if (headerBadge) {
                headerBadge.textContent = `📚 ${data.loaded} kitob yuklangan`;
                headerBadge.style.color = 'var(--accent-green)';
            }
        }
    } catch (e) {
        console.log('Books status check failed');
        const badge = document.getElementById('booksBadge');
        if (badge) {
            badge.textContent = '📚 DFX Tizimi Tayyor';
            badge.style.color = 'var(--accent-green)';
        }
    }
}

// -------- State --------
let currentSymbol = 'XAUUSD';
let currentInterval = '1h';
let candles = [];
let currentPrice = 0;
let priceChange = 0;
let animFrame = null;
let uploadedImageBase64 = null;

// -------- DOM Refs --------
const tvContainer = document.getElementById('tvChartContainer');
const currentPriceEl = document.getElementById('currentPrice');
const priceChangeEl = document.getElementById('priceChange');
const statOpen = document.getElementById('statOpen');
const statHigh = document.getElementById('statHigh');
const statLow = document.getElementById('statLow');
const statVol = document.getElementById('statVol');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('chartUpload');
const uploadPreview = document.getElementById('uploadPreview');
const uploadHint = document.getElementById('uploadHint');
const btnAnalyze = document.getElementById('btnAnalyze');
const analysisOutput = document.getElementById('analysisOutput');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

// ===========================
// TRADINGVIEW CHART INIT
// ===========================
let chart, candleSeries;

function initChart() {
    if (!tvContainer) return;
    tvContainer.innerHTML = ''; // Clear anyway
    const symbol = currentSymbol === 'XAUUSD' ? 'OANDA:XAUUSD' : `BINANCE:${currentSymbol}`;

    new TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "60",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#0d1117",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "container_id": "tvChartContainer",
        "background": "#0d1117",
        "gridColor": "rgba(42, 46, 57, 0.4)",
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "save_image": true,
        "details": true,
        "hotlist": true,
        "calendar": true,
        "show_popup_button": true,
        "popup_width": "1000",
        "popup_height": "650",
        "studies": [
            "RSI@tv-basicstudies",
            "StochasticRSI@tv-basicstudies",
            "PivotPointsHighLow@tv-basicstudies"
        ]
    });
}

// ===========================
// FETCH MARKET DATA
// ===========================
async function fetchCandles() {
    try {
        let symbol = currentSymbol;
        if (symbol === 'XAUUSD') symbol = 'PAXGUSDT';

        // Use the server's proxy endpoint instead of direct Binance link
        const url = `${API_BASE}/api/market/${symbol}?interval=${currentInterval}`;
        const res = await fetch(url);
        const dataJson = await res.json();
        const data = dataJson.data;

        if (!Array.isArray(data)) {
            if (currentSymbol === 'XAUUSD') {
                showToast('⚠️ Oltin ma\'lumoti yuklanmadi. Demo rejim...');
            }
            return;
        }

        candles = data.map(k => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));

        if (candles.length > 0) {
            const last = candles[candles.length - 1];
            const first = candles[0];
            currentPrice = last.close;
            priceChange = ((last.close - first.open) / first.open * 100);
            updateStats();

            const tvData = candles.map(c => ({
                time: c.time / 1000,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            }));
            candleSeries.setData(tvData);
            chart.timeScale().fitContent();
        }
    } catch (e) {
        console.warn('Binance API error', e);
        generateDemoCandles();
    }
}

let hiddenChart, hiddenSeries;
const hiddenContainer = document.getElementById('hiddenCaptureContainer');

function initHiddenChart() {
    if (!hiddenContainer) return;
    hiddenChart = LightweightCharts.createChart(hiddenContainer, {
        width: 1000, height: 600,
        layout: { background: { color: '#0d1117' }, textColor: '#8b949e' },
        grid: { vertLines: { color: '#161b22' }, horzLines: { color: '#161b22' } }
    });
    hiddenSeries = hiddenChart.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
        wickUpColor: '#26a69a', wickDownColor: '#ef5350'
    });
}

// Live Chart capture and AI Analysis via Hidden Engine
async function liveAnalyze() {
    if (!hiddenChart) initHiddenChart();

    showToast('⏳ Jonli bozor tahlil qilinmoqda...');

    try {
        let symbol = currentSymbol;
        if (symbol === 'XAUUSD') symbol = 'PAXGUSDT';

        // 1. Fetch freshest data
        const url = `${API_BASE}/api/market/${symbol}?interval=${currentInterval}`;
        const res = await fetch(url);
        const dataJson = await res.json();
        const freshCandles = dataJson.data;

        if (!Array.isArray(freshCandles)) throw new Error('Data failed');

        // 2. Map to TV format
        const tvData = freshCandles.map(k => ({
            time: k[0] / 1000, open: parseFloat(k[1]), high: parseFloat(k[2]),
            low: parseFloat(k[3]), close: parseFloat(k[4])
        }));

        // 3. Draw on hidden chart
        hiddenSeries.setData(tvData);
        hiddenChart.timeScale().fitContent();

        // 4. Small delay for rendering
        await new Promise(r => setTimeout(r, 600));

        // 5. Capture HIDDEN canvas (Not blocked by iframe)
        const canvas = hiddenContainer.querySelector('canvas');
        if (!canvas) throw new Error('Canvas not found');

        const screenshot = canvas.toDataURL('image/jpeg', 0.6);
        uploadedImageBase64 = screenshot;

        // Trigger AI analysis with fresh data
        analyzeChart(true);
    } catch (e) {
        console.error(e);
        showToast('❌ Jonli tahlilda xato. Iltimos skrinshot yuklang.');
    }
}

document.getElementById('btnLiveAnalyze').addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(100);
    liveAnalyze();
});

function updateStats() {
    if (!candles.length) return;
    const last = candles[candles.length - 1];
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const vols = candles.map(c => c.volume);

    currentPriceEl.textContent = formatPrice(currentPrice);
    priceChangeEl.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
    priceChangeEl.className = 'price-change ' + (priceChange >= 0 ? 'up' : 'down');

    statOpen.textContent = formatPrice(last.open);
    statHigh.textContent = formatPrice(Math.max(...highs));
    statLow.textContent = formatPrice(Math.min(...lows));
    statVol.textContent = formatVolume(vols.reduce((a, b) => a + b, 0));
}

function formatPrice(p) {
    if (currentSymbol.includes('XAU')) return p.toFixed(2);
    if (p > 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p > 1) return p.toFixed(4);
    return p.toFixed(6);
}

function formatVolume(v) {
    if (v > 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v > 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v > 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
}

// ===========================
// DEMO CANDLES (fallback)
// ===========================
function generateDemoCandles() {
    candles = [];
    let price = 43500;
    const now = Date.now();
    for (let i = 79; i >= 0; i--) {
        const open = price;
        const change = (Math.random() - 0.48) * price * 0.012;
        const close = open + change;
        const wick1 = Math.abs(Math.random() * price * 0.006);
        const wick2 = Math.abs(Math.random() * price * 0.006);
        candles.push({
            time: now - i * 3600000,
            open,
            high: Math.max(open, close) + wick1,
            low: Math.min(open, close) - wick2,
            close
        });
        price = close;
    }
    currentPrice = candles[candles.length - 1].close;
    priceChange = ((currentPrice - candles[0].open) / candles[0].open * 100);
    updateStats();

    // Format for TradingView
    const tvData = candles.map(c => ({
        time: c.time / 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
    }));
    candleSeries.setData(tvData);
}

// ===========================
// LIVE TICK ANIMATION
// ===========================
// ===========================
// LIVE MARKET WEBSOCKET
// ===========================
let ws = null;

function connectMarketWS() {
    if (ws) ws.close();

    let symbol = currentSymbol;
    if (symbol === 'XAUUSD') symbol = 'PAXGUSDT';

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${currentInterval}`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const k = data.k; // Kline data

        // Update current price global
        currentPrice = parseFloat(k.c);

        // Update UI
        currentPriceEl.textContent = formatPrice(currentPrice);

        // Update Chart
        candleSeries.update({
            time: k.t / 1000,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c)
        });

        // Update Stats/Change
        if (candles.length > 0) {
            priceChange = ((currentPrice - candles[0].open) / candles[0].open * 100);
            priceChangeEl.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
            priceChangeEl.className = 'price-change ' + (priceChange >= 0 ? 'up' : 'down');
        }
    };

    ws.onclose = () => {
        console.log('WS Closed. Reconnecting...');
        setTimeout(connectMarketWS, 5000);
    };
}

function startLiveTick() {
    // We now use WebSockets instead of fake ticks
    connectMarketWS();
}

// ===========================
// NAVIGATION (BOTTOM TABS)
// ===========================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Haptic feedback if supported
        if (navigator.vibrate) navigator.vibrate(50);

        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.view).classList.add('active');

        // Redraw chart if switching back to home
        if (btn.dataset.view === 'viewHome' && chart) {
            setTimeout(() => {
                chart.resize(tvContainer.clientWidth, tvContainer.clientHeight);
            }, 50);
        }
    });
});

// ===========================
// TIMEFRAME BUTTONS
// ===========================
document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(50);
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentInterval = btn.dataset.tf;
        fetchCandles();
        connectMarketWS();
    });
});

// ===========================
// MARKET SELECT
// ===========================
document.getElementById('marketSelect').addEventListener('change', (e) => {
    currentSymbol = e.target.value;
    fetchCandles();
    connectMarketWS();
});

// ===========================
// FILE UPLOAD
// ===========================
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFileSelect(file);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
});

// Double input for re-selection
const fileInputReselect = document.getElementById('chartUploadReselect');
if (fileInputReselect) {
    fileInputReselect.addEventListener('change', () => {
        if (fileInputReselect.files[0]) handleFileSelect(fileInputReselect.files[0]);
    });
}

function handleFileSelect(file) {
    if (navigator.vibrate) navigator.vibrate(50);
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageBase64 = e.target.result;
        uploadPreview.src = uploadedImageBase64;

        document.getElementById('previewContainer').style.display = 'block';
        uploadZone.style.display = 'none'; // Hide native upload box

        btnAnalyze.disabled = false;
        showToast('📸 Rasm yuklandi!');

        // Scroll slightly down
        window.scrollBy({ top: 150, behavior: 'smooth' });
    };
    reader.readAsDataURL(file);
}

// ===========================
// AI ANALYSIS
// ===========================
btnAnalyze.addEventListener('click', analyzeChart);

async function analyzeChart(isLive = false) {
    if (!uploadedImageBase64) {
        showToast('⚠️ Avval bozor skrinshotini yuklang!');
        return;
    }

    const pair = document.getElementById('pairInput').value || currentSymbol;
    const timeframe = document.getElementById('tfInput').value || currentInterval;

    // Switch to analysis tab (mobile view)
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-view="viewAnalysis"]').classList.add('active');
    document.getElementById('viewAnalysis').classList.add('active');

    // Show loading
    analysisOutput.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <div>AI bozorni tahlil qilmoqda...</div>
            <div style="font-size:0.72rem; opacity:0.5">DFX Strategiyalari asosida</div>
        </div>
    `;

    btnAnalyze.disabled = true;
    btnAnalyze.textContent = '⏳ Tahlil qilinmoqda...';

    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: uploadedImageBase64,
                pair,
                timeframe,
                additionalContext: ''
            })
        });
        const data = await res.json();
        if (data.success) {
            renderAnalysis(data.analysis);
            showToast('✅ Tahlil tayyor!');
            updateSignalsPanel(data.analysis, pair);
        } else {
            analysisOutput.innerHTML = `<div style="color:#ff4757; padding:16px; font-size:0.82rem;">❌ Xato: ${data.error}</div>`;
        }
    } catch (e) {
        analysisOutput.innerHTML = `<div style="color:#ff4757; padding:16px; font-size:0.82rem;">❌ Server bilan ulanishda xato. Server ishlamoqdami?</div>`;
    }

    btnAnalyze.disabled = false;
    btnAnalyze.innerHTML = '🤖 AI Bilan Tahlil Qilish';
}

function renderAnalysis(text) {
    const sections = text.split(/## /g).filter(Boolean);
    let html = '<div class="analysis-result">';
    sections.forEach(sec => {
        const lines = sec.split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        html += `<div class="md-section">
            <div class="md-h2">${title}</div>
            <div class="md-text">${markdownToHtml(body)}</div>
        </div>`;
    });
    html += '</div>';
    analysisOutput.innerHTML = html;
}

function markdownToHtml(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e8eaf6">$1</strong>')
        .replace(/🟢 SOTIB OL \(BUY\)/g, '<div class="signal-badge signal-buy">🟢 SOTIB OL (BUY)</div>')
        .replace(/🔴 SOT \(SELL\)/g, '<div class="signal-badge signal-sell">🔴 SOT (SELL)</div>')
        .replace(/🟡 KUTISH \(WAIT\)/g, '<div class="signal-badge signal-wait">🟡 KUTISH (WAIT)</div>')
        .replace(/🟢 SOTIB OL/g, '<span class="signal-badge signal-buy">🟢 SOTIB OL</span>')
        .replace(/🔴 SOT/g, '<span class="signal-badge signal-sell">🔴 SOT</span>')
        .replace(/🟡 KUTISH/g, '<span class="signal-badge signal-wait">🟡 KUTISH</span>')
        .replace(/\n/g, '<br>');
}

function updateSignalsPanel(analysisText, pair) {
    const isBuy = analysisText.includes('SOTIB OL');
    const isSell = analysisText.includes('SOT') && !isBuy;
    const dir = isBuy ? 'BUY' : (isSell ? 'SELL' : 'WAIT');

    // Update Signal History
    appendToSignalHistory(pair, dir);
}

function appendToSignalHistory(pair, dir) {
    const historyEl = document.getElementById('signalHistory');
    if (!historyEl) return;

    // Remove empty placeholder
    if (historyEl.textContent.includes('yo\'q')) historyEl.innerHTML = '';

    const item = document.createElement('div');
    item.className = 'history-item';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dirClass = dir === 'BUY' ? 'buy' : (dir === 'SELL' ? 'sell' : '');

    item.innerHTML = `
        <div style="display:flex; align-items:center;">
            <span class="history-pair">${pair}</span>
            <span class="history-time">${timeStr}</span>
        </div>
        <div class="history-dir ${dirClass}">${dir}</div>
    `;

    historyEl.prepend(item);
}

// ===========================
// AI CHAT & VOICE
// ===========================

// Voice Recognition Init
const btnMic = document.getElementById('btnMicChat');
let recognition;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        chatInput.value = transcript;
        showToast('🎙 Gap matnga aylantirildi!');
    };

    recognition.onerror = (e) => {
        showToast('🎙 Xato: ' + e.error);
        stopRecording();
    };

    recognition.onend = () => {
        stopRecording();
    };

    btnMic.addEventListener('click', () => {
        if (isRecording) stopRecording();
        else startRecording();
    });
} else {
    if (btnMic) btnMic.style.display = 'none'; // yashiramiz agar brauzer qo'llab-quvvatlamasa
}

function startRecording() {
    if (!recognition) return;
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    recognition.start();
    isRecording = true;
    btnMic.style.color = '#ff4757';
    btnMic.style.animation = 'pulse 1.5s infinite';
}

function stopRecording() {
    if (!recognition) return;
    isRecording = false;
    btnMic.style.color = 'var(--accent-gold)';
    btnMic.style.animation = 'none';
}

chatInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await sendChat();
    }
});

document.getElementById('btnSendChat').addEventListener('click', sendChat);

async function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendMsg(msg, 'user');
    chatInput.value = '';

    const thinking = appendMsg('⏳ Savol tahlil qilinmoqda...', 'ai');

    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        thinking.textContent = data.success ? data.response : '❌ ' + data.error;
    } catch {
        thinking.textContent = '❌ Server bilan ulanishda xato.';
    }
}

function appendMsg(text, type) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

// ===========================
// KNOWLEDGE CARDS (click)
// ===========================
document.querySelectorAll('.knowledge-card, .candle-item').forEach(card => {
    card.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(50);

        let topic;
        if (card.classList.contains('knowledge-card')) {
            topic = card.querySelector('.knowledge-card-title').textContent;
        } else {
            topic = card.querySelector('.candle-name').textContent;
        }

        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-view="viewChat"]').classList.add('active');
        document.getElementById('viewChat').classList.add('active');

        chatInput.value = topic + ' yapon shami haqida DFX metodikasi bo\'yicha tushuntirib bering.';
        sendChat();
    });
});

// ===========================
// TOAST
// ===========================
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===========================
// INIT
// ===========================
async function init() {
    initChart();
    generateDemoCandles(); // Show immediately
    startLiveTick();
    await fetchCandles();  // Then fetch real
    setInterval(fetchCandles, 60000); // Refresh every minute
    fetchBooksStatus();    // Load PDF books status from server
}

init();
