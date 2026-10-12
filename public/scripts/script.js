document.addEventListener("DOMContentLoaded", () => {
    /* document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", () => {
            card.classList.toggle("active");
        });
    }); */

    const toggle = document.querySelector(".menu-toggle, #menu-toggle");
    const nav = document.getElementById("nav");

    if (toggle && nav) {
        toggle.addEventListener("click", () => {
            nav.classList.toggle("active");
        });

        document.querySelectorAll("#nav a").forEach(link => {
            link.addEventListener("click", () => {
                nav.classList.remove("active");
            });
        });
    }

    syncVisitorIdToLocalStorage();
    initStampRally();
});

document.querySelectorAll(".nav-group-toggle").forEach(button => {
    button.addEventListener("click", () => {

        const group = button.parentElement;
        const submenu = group.querySelector(".nav-submenu");

        group.classList.toggle("open");

        if (group.classList.contains("open")) {
            submenu.style.maxHeight = submenu.scrollHeight + "px";
        } else {
            submenu.style.maxHeight = "0";
        }
    });
});

async function syncVisitorIdToLocalStorage() {
    try {
        const response = await fetch('/api/visitor/me', { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));

        if (response.ok && result.ok && result.visitor_id) {
            localStorage.setItem('visitor_id', String(result.visitor_id));
        }
    } catch (error) {
        console.warn('訪問者IDの保存に失敗しました', error);
    }
}

function initStampRally() {
    const storageKey = "kosensai-stamp-rally";
    const rewardStorageKey = "kosensai-stamp-rally-reward-acquired";
    const analyticsKey = "kosensai-stamp-rally-analytics";
    const startStateKey = "kosensai-stamp-rally-started";
    let locations = [];
    let stampCards = [];
    let stampSheetSlots = [];
    const statusEl = document.getElementById("scan-status");
    const summaryEl = document.getElementById("stamp-summary");
    const stampSheetEl = document.getElementById("stamp-sheet");
    const stampSheetCountEl = document.getElementById("stamp-sheet-count");
    const stampSheetTotalEl = document.getElementById("stamp-sheet-total");
    const stampSheetRateEl = document.getElementById("stamp-sheet-rate");
    const stampSheetFillEl = document.getElementById("stamp-sheet-fill");
    const stampRewardStatusEl = document.querySelector(".stamp-reward-status");
    const stampRewardStateEl = document.getElementById("stamp-reward-state");
    const startBtn = document.getElementById("start-scan");
    const startRallyBtn = document.getElementById("begin-rally");
    const rallyIntroSection = document.getElementById("stamp-rally-start");
    const stampSection = document.getElementById("stamp-rally");
    const readerEl = document.getElementById("reader");
    const surveyAgeEl = document.getElementById("survey-age-group");
    const surveyDiscoveryEl = document.getElementById("survey-discovery");
    const surveyAreaEl = document.getElementById("survey-area");
    const scanModalEl = document.getElementById("scan-modal");
    const scanModalCloseBtn = document.getElementById("scan-modal-close");
    const scanModalRetryBtn = document.getElementById("scan-modal-retry");
    const scanSuccessEl = document.getElementById("scan-success");

    let scanner = null;
    let scanModalOpen = false;
    let scanBusy = false;
    let scanStatusTimer = null;
    let modalCloseTimer = null;
    let scannerStartToken = 0;
    let scanLineAnimationId = null;

    const stampThemes = [
        { primary: "#dc2626", secondary: "#f59e0b", surface: "#fff7ed" },
        { primary: "#c2410c", secondary: "#fb7185", surface: "#fff7ed" },
        { primary: "#2563eb", secondary: "#22c55e", surface: "#eff6ff" },
        { primary: "#7c3aed", secondary: "#f97316", surface: "#f5f3ff" },
        { primary: "#0f766e", secondary: "#38bdf8", surface: "#f0fdfa" },
        { primary: "#be185d", secondary: "#f43f5e", surface: "#fff1f2" },
        { primary: "#0f172a", secondary: "#2563eb", surface: "#f8fafc" },
        { primary: "#166534", secondary: "#84cc16", surface: "#f0fdf4" },
    ];

    /*
    旧・会場スポット版の定義は将来の再利用用に残しています。
    const legacyLocations = [
        { id: "entrance", name: "正門", note: "正門横の案内ブース", linkText: "会場マップへ", href: "/map.html" },
        { id: "museum", name: "展示ホール", note: "展示ホール入口", linkText: "高専祭とはへ", href: "/about.html" },
        { id: "stage", name: "ステージ", note: "ステージ前の案内", linkText: "イベント紹介へ", href: "/event.html" },
        { id: "shop", name: "模擬店エリア", note: "模擬店エリア入口", linkText: "模擬店紹介へ", href: "/shop.html" },
    ];
    */

    async function loadCompanyMaster() {
        try {
            const response = await fetch('./scripts/companies.json', {
                cache: 'no-store'
            });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                return [];
            }

            return data
                // exhibition が true の企業だけを対象にする
                .filter(item => item.exhibition === true)

                // 必要なデータだけを取り出す
                .map((item, index) => ({
                    id: String(item.id || `company-${index + 1}`),
                    name: String(item.name || `企業${index + 1}`),
                    note: String(
                        item.note ||
                        `${String(item.name || `企業${index + 1}`)}のブース前のQRコードを読み取る`
                    ),
                    linkText: String(item.linkText || '企業紹介へ'),
                    href: String(item.href || '/company.html'),
                    image: String(item.image || '/header_ed.jpg')
                }))
                .concat(
                    Array.isArray(window.stampRallyAdditionalLocations)
                        ? window.stampRallyAdditionalLocations.map((item, index) => ({
                            id: String(item.id || `additional-${index + 1}`),
                            name: String(item.name || `追加団体${index + 1}`),
                            note: String(item.note || '展示・活動をお楽しみください。'),
                            linkText: String(item.linkText || '展示紹介へ'),
                            href: String(item.href || './exhibition.html'),
                            image: String(item.image || './images/noimage.png')
                        }))
                        : []
                );

        } catch (error) {
            console.warn(
                '出展企業マスタの読み込みに失敗しました',
                error
            );
            return [];
        }
    }

    /* async function loadCompanyMaster() {
        try {
            const response = await fetch('./scripts/companies.json', { cache: 'no-store' });
            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }

            return data.map((item, index) => ({
                id: String(item.id || `company-${String.fromCharCode(97 + index)}`),
                name: String(item.name || `企業${String.fromCharCode(65 + index)}`),
                note: String(item.note || `${String(item.name || `企業${String.fromCharCode(65 + index)}`)}のブース前のQRコードを読み取る`),
                linkText: String(item.linkText || '企業紹介へ'),
                href: String(item.href || '/company.html'),
                image: String(item.image || '/header_ed.jpg')
            }));
        } catch (error) {
            console.warn('出展企業マスタの読み込みに失敗しました', error);
            return [];
        }
    } */

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function hashString(value) {
        return String(value).split('').reduce((hash, character) => {
            return ((hash << 5) - hash + character.charCodeAt(0)) | 0;
        }, 0);
    }

    function getStampTheme(index, seedValue) {
        const seed = Math.abs(hashString(`${seedValue}:${index}`));
        return stampThemes[seed % stampThemes.length];
    }

    function createStampSvg(index, label, seedValue) {
        const theme = getStampTheme(index, seedValue);
        const safeLabel = escapeHtml(label);

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${safeLabel}のスタンプ">
                <rect width="240" height="240" rx="28" fill="${theme.surface}"/>
                <circle cx="120" cy="120" r="86" fill="none" stroke="${theme.primary}" stroke-width="10"/>
                <circle cx="120" cy="120" r="66" fill="none" stroke="${theme.secondary}" stroke-width="8" stroke-dasharray="12 10"/>
                <path d="M54 120h132" stroke="${theme.primary}" stroke-width="8" stroke-linecap="round"/>
                <path d="M120 54v132" stroke="${theme.primary}" stroke-width="8" stroke-linecap="round"/>
                <circle cx="120" cy="120" r="22" fill="${theme.secondary}" opacity="0.18"/>
                <text x="120" y="132" text-anchor="middle" fill="${theme.primary}" font-family="Arial, sans-serif" font-size="36" font-weight="800" transform="rotate(-8 120 120)">STAMP</text>
            </svg>
        `)}`;
    }

    //               <canvas class="stamp-qr" width="160" height="160" aria-label="${location.name}のQRコード"></canvas>
    //                <p class="stamp-note">${location.note}</p>

    function renderStampCards() {
        const stampGrid = document.getElementById('stamp-grid');
        if (!stampGrid) return;

        stampGrid.innerHTML = locations.map((location, index) => {
            const locationId = String(location.id);
            const isNonNavigable = locationId.startsWith('department-') || locationId.startsWith('club-');
            const link = isNonNavigable
                ? ''
                : `<a class="stamp-link" href="${location.href || '/company.html'}" data-stamp-id="${location.id}">${location.linkText || '企業紹介へ'}</a>`;

            return `
            <article class="stamp-card" data-stamp-id="${location.id}">
                <p class="stamp-label">STEP ${index + 1}</p>
                <img class="stamp-thumb" src="${location.image || '/header_ed.jpg'}" alt="${location.name}のサムネイル">
                <h3>${location.name}</h3>
                ${link}
                <p class="stamp-status">未訪問</p>
            </article>
            `;
        }).join('');

        stampCards = Array.from(stampGrid.querySelectorAll('.stamp-card'));

        document.querySelectorAll('#stamp-grid .stamp-link').forEach(link => {
            link.addEventListener('click', () => {
                recordJump(link.dataset.stampId);
            });
        });

        generateQrCodes();
    }

    function renderStampSheet() {
        if (!stampSheetEl) return;

        const total = locations.length || 0;

        if (!total) {
            stampSheetEl.innerHTML = '<p class="stamp-note">出展企業情報を読み込んでいます。</p>';
            stampSheetSlots = [];
            return;
        }

        stampSheetEl.innerHTML = locations.map((location, index) => {
            const theme = getStampTheme(index, location.id);

            return `
                <article class="stamp-sheet-slot" data-slot-index="${index}" style="--stamp-slot-color:${theme.primary}; --stamp-slot-color-soft:${theme.secondary}; --stamp-slot-surface:${theme.surface};">
                    <div class="stamp-sheet-slot-visual">
                        <span class="stamp-sheet-empty">空き枠</span>
                        <img class="stamp-sheet-badge" src="${createStampSvg(index, location.name, location.id)}" alt="${escapeHtml(location.name)}のスタンプ" loading="lazy">
                    </div>
                    <div class="stamp-sheet-slot-meta">
                        <span class="stamp-sheet-step">SLOT ${String(index + 1).padStart(2, '0')}</span>
                    </div>
                </article>
            `;
        }).join('');

        stampSheetSlots = Array.from(stampSheetEl.querySelectorAll('.stamp-sheet-slot'));
    }
    //                        <strong>${escapeHtml(location.name)}</strong>

    function loadVisited() {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || "[]");
        } catch (error) {
            console.warn("訪問履歴の読み込みに失敗しました", error);
            return [];
        }
    }

    function saveVisited(visited) {
        localStorage.setItem(storageKey, JSON.stringify(visited));
    }

    function loadRewardAcquired() {
        return localStorage.getItem(rewardStorageKey) === "true";
    }

    function saveRewardAcquired() {
        localStorage.setItem(rewardStorageKey, "true");
    }

    function renderRewardState() {
        const acquired = loadRewardAcquired();
        if (stampRewardStatusEl) {
            stampRewardStatusEl.classList.toggle("is-acquired", acquired);
        }
        if (stampRewardStateEl) {
            stampRewardStateEl.textContent = acquired ? "受け取り済み" : "未受け取り";
        }
    }

    // サーバー側の訪問履歴は管理者向けに限定するため、公開ページでは取得しません。

    function generateQrCodes() {
        stampCards.forEach(card => {
            const id = card.dataset.stampId;
            const canvas = card.querySelector(".stamp-qr");
            if (!canvas || !window.QRCode) return;

            QRCode.toCanvas(canvas, `kosen-stamp:${id}`, { width: 160, margin: 1 }, error => {
                if (error) {
                    console.error("QRコード生成に失敗しました", error);
                }
            });
        });
    }

    async function markVisited(code) {
        if (scanBusy) {
            return;
        }

        const parsed = parseStampCode(code);

        if (!parsed.ok) {
            setScanModalState("is-error");
            setScanRetryVisible(false);
            setScanMessage(parsed.message);

            if (scanStatusTimer) {
                clearTimeout(scanStatusTimer);
            }

            scanStatusTimer = window.setTimeout(() => {
                if (!scanBusy && scanModalOpen) {
                    setScanModalState("is-scanning");
                    setScanMessage("QRコードを枠内に合わせてください。");
                }
            }, 1200);
            return;
        }

        if (parsed.type === "reward") {
            await finishSuccessfulAcquisition();
            return;
        }

        await finishSuccessfulScan(parsed.id, parsed.location);
    }

    function recordJump(id) {
        const location = locations.find(item => item.id === id);
        if (!location) return;

        const analytics = loadAnalytics();
        analytics.jumps[id] = (analytics.jumps[id] || 0) + 1;
        saveAnalytics(analytics);
        sendStampEvent('jump', id);
        renderStampState();
        statusEl.textContent = `${location.name} の関連リンクを開きました。`;
    }

    function stopScanner() {
        if (!scanner) return Promise.resolve();

        return scanner.stop().catch(() => {
            // カメラ停止時は無視する
        });
    }

    /* async function startScanner() {
        openScanModal();

        if (!window.Html5Qrcode) {
            setScanMessage("カメラ機能を読み込めませんでした。");
            setScanModalState("is-error");
            return;
        }

        if (scanner) {
            await stopScanner();
            scanner = null;
        }

        const startToken = ++scannerStartToken;
        if (readerEl) {
            readerEl.innerHTML = "";
        }
        scanner = new Html5Qrcode("reader");

        try {
            setScanBusy(false);
            setScanRetryVisible(false);
            setScanModalState("is-scanning");
            setScanMessage("カメラを起動しています…");

            await sleep(50);

            if (!scanModalOpen || startToken !== scannerStartToken) {
                await stopScanner();
                scanner = null;
                return;
            }

            let cameraConfig = { facingMode: "environment" };

            if (typeof Html5Qrcode.getCameras === "function") {
                try {
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length) {
                        const backCamera = cameras.find(cam => /(back|rear|environment)/i.test(cam.label));
                        if (backCamera || cameras[0]) {
                            const selectedCamera = backCamera || cameras[0];
                            cameraConfig = { deviceId: selectedCamera.id };
                        }
                    }
                } catch (error) {
                    console.warn("カメラ一覧の取得に失敗しました", error);
                }
            }

            await scanner.start(
                cameraConfig,
                { fps: 10, qrbox: { width: 260, height: 260 } },
                (decodedText) => {
                    markVisited(decodedText);
                },
                () => {}
            );

            if (startToken !== scannerStartToken) {
                await stopScanner();
                scanner = null;
                return;
            }

            setScanMessage("QRコードを枠内に合わせてください。");
        } catch (error) {
            console.error("カメラ起動に失敗しました", error);
            setScanModalState("is-error");
            setScanMessage("カメラを起動できませんでした。端末のカメラ利用権限を許可するか、対応ブラウザで再度お試しください。");
            setScanRetryVisible(true);
            setScanBusy(false);
            scanner = null;
        }
    } */

    async function startScanner() {

        openScanModal();

        if (!window.Html5Qrcode) {
            setScanMessage("カメラ機能を読み込めませんでした。");
            setScanModalState("is-error");
            return;
        }

        if (scanner) {
            await stopScanner();
            scanner = null;
        }

        if (readerEl) {
            readerEl.innerHTML = "";
        }

        scanner = new Html5Qrcode("reader");

        try {

            setScanBusy(false);
            setScanRetryVisible(false);
            setScanModalState("is-scanning");
            setScanMessage("カメラを起動しています…");

            await sleep(50);

            if (!scanModalOpen) {
                await stopScanner();
                scanner = null;
                return;
            }

            /*
             * 背面カメラを指定
             *
             * iPhoneではこちらの方式のほうが
             * getCameras() + deviceId より安定して
             * 背面カメラを選択できる。
             */
            const cameraConfig = {
                facingMode: "environment"
            };

            await scanner.start(

                cameraConfig,

                {
                    fps: 10,
                    qrbox: {
                        width: 260,
                        height: 260
                    }
                },

                (decodedText) => {

                    markVisited(decodedText);

                },

                () => {
                    // QR未検出時
                }

            );

            setScanMessage(
                "QRコードを枠内に合わせてください。"
            );

        } catch (error) {

            console.error(
                "カメラ起動に失敗しました",
                error
            );

            setScanModalState("is-error");

            setScanMessage(
                "カメラを起動できませんでした。" +
                "端末のカメラ利用権限を確認してください。"
            );

            setScanRetryVisible(true);
            setScanBusy(false);

            scanner = null;
        }
    }

    async function startStampRally() {
        saveStartState();
        await sendSurveyAttributes();

        applyStartState(true);

        if (stampSection) {
            stampSection.scrollIntoView({ behavior: "smooth" });
        }
        if (statusEl) {
            statusEl.textContent = "スタンプラリーを開始しました。カードとカメラを使ってQRコードを読み取ってください。";
        }
    }

    if (startRallyBtn) {
        startRallyBtn.addEventListener("click", startStampRally);
    }

    if (startBtn) {
        startBtn.addEventListener("click", () => {
            startScanner();
        });
    }

    if (scanModalCloseBtn) {
        scanModalCloseBtn.addEventListener("click", () => {
            closeScanModal();
        });
    }

    if (scanModalRetryBtn) {
        scanModalRetryBtn.addEventListener("click", () => {
            startScanner();
        });
    }

    if (scanModalEl) {
        scanModalEl.addEventListener("click", event => {
            if (event.target && event.target.dataset && event.target.dataset.scanClose === "backdrop") {
                closeScanModal();
            }
        });
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && scanModalOpen) {
            closeScanModal();
        }
    });

    // ============================================
    // 新しい演出関連の関数群
    // ============================================

    /**
     * スキャンラインアニメーションを開始
     * @param {HTMLElement} container - モーダルのコンテナ要素
     * @returns {void}
     */
    function startScanLineAnimation(container) {
        // 既存アニメーションをクリア
        if (scanLineAnimationId) {
            cancelAnimationFrame(scanLineAnimationId);
        }

        const reader = container.querySelector('#reader');
        if (!reader) return;

        // スキャンラインを作成
        let scanLine = container.querySelector('.scan-line');
        if (!scanLine) {
            scanLine = document.createElement('div');
            scanLine.className = 'scan-line';
            reader.appendChild(scanLine);
        }

        let progress = 0;
        const duration = 1800; // 1.8秒で一往復
        let startTime = Date.now();
        let direction = 1; // 1: 下向き, -1: 上向き

        const animate = () => {
            const elapsed = Date.now() - startTime;
            progress = (elapsed % duration) / duration;

            // 往復アニメーション（0→1→0）
            let position;
            if (progress < 0.5) {
                position = progress * 2; // 0→1（下へ）
            } else {
                position = (1 - progress) * 2; // 1→0（上へ）
            }

            scanLine.style.top = `${position * 100}%`;

            if (scanModalOpen && scanLineAnimationId !== null) {
                scanLineAnimationId = requestAnimationFrame(animate);
            }
        };

        scanLineAnimationId = requestAnimationFrame(animate);
    }

    /**
     * スキャンラインアニメーションを停止
     */
    function stopScanLineAnimation() {
        if (scanLineAnimationId) {
            cancelAnimationFrame(scanLineAnimationId);
            scanLineAnimationId = null;
        }

        const scanLine = document.querySelector('.scan-line');
        if (scanLine) {
            scanLine.remove();
        }
    }

    /**
     * スキャン完了の演出（段階的に実行）
     */
    async function playScanCompletionSequence() {
        // 1. スキャンラインを停止
        stopScanLineAnimation();

        // 2. チェックマークを表示（100ms）
        if (scanSuccessEl) {
            scanSuccessEl.classList.remove("is-visible");
            void scanSuccessEl.offsetWidth; // reflow を強制
            scanSuccessEl.classList.add("is-visible");
        }

        // 3. 効果音再生（同時実行）
        await playSuccessTone();

        // 4. チェックマーク表示の余韻（200ms）
        await sleep(500);
    }

    async function acquireStamp(companyId) {
        try {
            const response = await fetch('/api/stamp/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_id: companyId }),
            });

            const result = await response.json().catch(() => ({}));

            if (response.ok) {
                return { ok: true, result };
            }

            if (String(result.error || '').includes('already acquired')) {
                return { ok: true, already: true, result };
            }

            console.warn('スタンプ取得の記録に失敗しました', result);
            return { ok: false, result };
        } catch (error) {
            console.warn('スタンプ取得の送信に失敗しました', error);
            return { ok: false, error };
        }
    }

    async function sendStampEvent(type, stampId) {
        try {
            const attributes = collectSurveyAttributes();
            await fetch('/api/stamp-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    stampId,
                    page: window.location.pathname,
                    attributes: attributes || {},
                }),
            });
        } catch (error) {
            console.warn('サーバーへの送信に失敗しました', error);
        }
    }

    function collectSurveyAttributes() {
        const attributes = {
            age: surveyAgeEl ? surveyAgeEl.value : '',
            discovery: surveyDiscoveryEl ? surveyDiscoveryEl.value : '',
            area: surveyAreaEl ? surveyAreaEl.value : '',
        };

        const filtered = Object.fromEntries(
            Object.entries(attributes).filter(([, value]) => String(value || '').trim() !== '')
        );

        return Object.keys(filtered).length ? filtered : null;
    }

    async function sendSurveyAttributes() {
        const attributes = collectSurveyAttributes();

        try {
            await fetch('/api/stamp-survey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attributes }),
            });
        } catch (error) {
            console.warn('アンケート属性の送信に失敗しました', error);
        }
    }

    function loadAnalytics() {
        try {
            return JSON.parse(localStorage.getItem(analyticsKey) || "{\"visits\":{},\"jumps\":{}}")
        } catch (error) {
            console.warn("集計データの読み込みに失敗しました", error);
            return { visits: {}, jumps: {} };
        }
    }

    function saveAnalytics(analytics) {
        localStorage.setItem(analyticsKey, JSON.stringify(analytics));
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function setScanMessage(message) {
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    function setScanModalState(state) {
        if (!scanModalEl) return;

        scanModalEl.classList.remove("is-scanning", "is-success", "is-loading", "is-error", "is-closing");
        if (state) {
            scanModalEl.classList.add(state);
        }
    }

    function setScanRetryVisible(visible) {
        if (!scanModalRetryBtn) return;
        scanModalRetryBtn.classList.toggle("hidden", !visible);
    }

    function setScanCloseEnabled(enabled) {
        if (!scanModalCloseBtn) return;
        scanModalCloseBtn.disabled = !enabled;
    }

    function setScanBusy(isBusy) {
        scanBusy = isBusy;
        setScanCloseEnabled(!isBusy);
        if (scanModalRetryBtn) {
            scanModalRetryBtn.disabled = isBusy;
        }
    }

    function resetScanVisuals() {
        if (scanSuccessEl) {
            scanSuccessEl.classList.remove("is-visible");
        }
        setScanRetryVisible(false);
        setScanCloseEnabled(true);
        setScanModalState("is-scanning");
    }

    function openScanModal() {
        if (!scanModalEl || scanModalOpen) {
            return;
        }

        scanModalOpen = true;
        scanModalEl.classList.remove("hidden");
        scanModalEl.setAttribute("aria-hidden", "false");
        document.body.classList.add("scan-modal-open");
        resetScanVisuals();
        setScanMessage("カメラを起動しています…");

        requestAnimationFrame(() => {
            scanModalEl.classList.add("is-open");
        });
    }

    async function closeScanModal(force = false) {
        if (!scanModalEl || !scanModalOpen) {
            return;
        }

        if (scanBusy && !force) {
            return;
        }

        const closeToken = ++scannerStartToken;

        // スキャンラインアニメーション停止
        stopScanLineAnimation();

        if (scanStatusTimer) {
            clearTimeout(scanStatusTimer);
            scanStatusTimer = null;
        }
        if (modalCloseTimer) {
            clearTimeout(modalCloseTimer);
            modalCloseTimer = null;
        }

        scanModalOpen = false;
        scanModalEl.classList.remove("is-open", "is-scanning", "is-success", "is-loading", "is-error");
        scanModalEl.classList.add("is-closing");
        setScanCloseEnabled(false);
        setScanRetryVisible(false);

        await stopScanner();
        scanner = null;

        if (closeToken !== scannerStartToken) {
            return;
        }

        modalCloseTimer = window.setTimeout(() => {
            scanModalEl.classList.remove("is-closing");
            scanModalEl.classList.add("hidden");
            scanModalEl.setAttribute("aria-hidden", "true");
            document.body.classList.remove("scan-modal-open");
            setScanMessage("カメラを起動すると、読み取ったQRコードの場所を記録できます。");
            setScanCloseEnabled(true);
            setScanRetryVisible(false);
        }, 500);
    }

    async function playSuccessTone() {
        try {
            const audio = new Audio("../readsound.mp3");
            audio.volume = 0.8;
            await audio.play();
        } catch (error) {
            console.warn("成功音の再生に失敗しました", error);
        }
    }

    /* async function playSuccessTone() {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
            return;
        }

        try {
            const context = playSuccessTone.context || (playSuccessTone.context = new AudioContextCtor());
            if (context.state === "suspended") {
                await context.resume();
            }

            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 1);
            gain.gain.setValueAtTime(0.1, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.5, context.currentTime + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 1);
        } catch (error) {
            console.warn("成功音の再生に失敗しました", error);
        }
    } */

    function parseStampCode(code) {
        if (String(code || "").trim() === "Kosensai-stamp:AcquiredCode") {
            return { ok: true, type: "reward" };
        }

        const match = String(code || "").match(/^kosen-stamp:([^\s:]+)$/i);

        if (!match) {
            return { ok: false, message: "このQRコードはスタンプラリー用ではありません。" };
        }

        const id = match[1];
        const location = locations.find(item => item.id === id);

        if (!location) {
            return { ok: false, message: "登録されていない場所のQRコードです。" };
        }

        return { ok: true, id, location };
    }

    function applySuccessfulStamp(id, location) {
        const visited = loadVisited().filter(item => item !== id);
        visited.push(id);
        saveVisited(visited);

        const analytics = loadAnalytics();
        analytics.visits[id] = (analytics.visits[id] || 0) + 1;
        saveAnalytics(analytics);

        renderStampState();
        setScanMessage(`${location.name} のスタンプを記録しました。`);
    }

    async function finishSuccessfulAcquisition() {
        setScanBusy(true);
        setScanModalState("is-success");
        setScanRetryVisible(false);
        setScanMessage("受け取りQRを確認しています…");

        await sleep(200);
        startScanLineAnimation(scanModalEl);
        await sleep(1200);
        await playScanCompletionSequence();
        await stopScanner();
        scanner = null;

        setScanModalState("is-loading");
        setScanMessage("粗品の受け取り状態を記録しています…");
        saveRewardAcquired();
        renderRewardState();
        setScanBusy(false);
        setScanMessage("粗品を受け取り済みにしました。");

        await sleep(300);
        await closeScanModal(true);
    }

    /**
     * 改良されたfinishSuccessfulScan関数
     * スキャンライン、段階的な演出、最適化されたタイミング
     */
    async function finishSuccessfulScan(id, location) {
        setScanBusy(true);
        setScanModalState("is-success");
        setScanRetryVisible(false);
        setScanMessage("読み取り中…");

        // 1. スキャンラインアニメーション開始（200ms間隔）
        // モーダルがDOM内に存在することを確認してから開始
        await sleep(200);
        startScanLineAnimation(scanModalEl);

        // 2. スキャンラインを流す（1200ms）
        await sleep(1200);

        // 3. チェックマーク表示 → 効果音再生の演出（合計400ms）
        await playScanCompletionSequence();

        // 4. カメラ停止 + ローディング状態へ遷移（素早く）
        await stopScanner();
        scanner = null;

        setScanModalState("is-loading");
        setScanMessage("スタンプを記録しています…");

        // 5. サーバー通信（時間は変動）
        const recordResult = await acquireStamp(id);

        if (recordResult.ok) {
            // 6. スタンプ反映（ローカルストレージ更新）
            applySuccessfulStamp(id, location);
            setScanBusy(false);

            // 7. モーダル閉じる前に少し余韻（300ms）
            await sleep(300);
            await closeScanModal(true);
            return;
        }

        // エラー時の処理
        setScanBusy(false);
        setScanModalState("is-error");
        setScanRetryVisible(true);
        setScanCloseEnabled(true);
        setScanMessage("スタンプの記録に失敗しました。通信状況を確認して、再試行してください。");
    }

    //スタンプラリー開始履歴復元---------------------------------------
    function loadStartState() {
        try {
            const explicitState = localStorage.getItem(startStateKey);
            if (explicitState === "true") {
                return true;
            }
            if (explicitState === "false") {
                return false;
            }
        } catch (error) {
            console.warn("開始状態の読み込みに失敗しました", error);
        }

        const visited = loadVisited();
        const analytics = loadAnalytics();

        return visited.length > 0
            || Object.keys(analytics.visits || {}).length > 0
            || Object.keys(analytics.jumps || {}).length > 0;
    }

    function saveStartState() {
        localStorage.setItem(startStateKey, "true");
    }

    function applyStartState(started) {
        if (rallyIntroSection) {
            rallyIntroSection.classList.toggle("hidden", started);
        }
        if (stampSection) {
            stampSection.classList.toggle("hidden", !started);
        }
    }

    const started = loadStartState();
    applyStartState(started);
    //---------------------------------------------------------------------------
    function renderStampState() {
        if (!stampCards.length) {
            stampCards = Array.from(document.querySelectorAll('.stamp-card'));
        }
        if (!stampSheetSlots.length) {
            stampSheetSlots = Array.from(document.querySelectorAll('.stamp-sheet-slot'));
        }

        const visited = Array.from(new Set(loadVisited()));
        renderRewardState();
        const analytics = loadAnalytics();
        const total = locations.length || 0;
        const visitedCount = Math.min(visited.length, total);
        const progress = total ? Math.round((visitedCount / total) * 100) : 0;

        stampCards.forEach(card => {
            const id = card.dataset.stampId;
            const visitedNow = visited.includes(id);
            card.classList.toggle("visited", visitedNow);
            const status = card.querySelector(".stamp-status");
            if (status) {
                if (visitedNow) {
                    status.innerHTML = `<span class="visited-icon">✔︎</span>`;
                } else {
                    status.textContent = "未訪問";
                }
            }

            const metrics = card.querySelector(".stamp-metrics");
            if (metrics) {
                // 値の表示は廃止：将来的に画像で済アイコンを差し替え予定
                metrics.textContent = '';
            }
        });

        stampSheetSlots.forEach((slot, index) => {
            slot.classList.toggle('filled', index < visitedCount);
        });

        if (stampSheetCountEl) {
            stampSheetCountEl.textContent = String(visitedCount);
        }
        if (stampSheetTotalEl) {
            stampSheetTotalEl.textContent = String(total);
        }
        if (stampSheetRateEl) {
            stampSheetRateEl.textContent = `${progress}%`;
        }
        if (stampSheetFillEl) {
            stampSheetFillEl.style.width = total ? `${(visitedCount / total) * 100}%` : '0%';
        }

        /* summaryEl.textContent = total
            ? `現在 ${visitedCount} / ${total} 件の出展企業を訪問済みです（${progress}%）。スタンプシートは先頭から順に埋まり、この端末の履歴と集計は localStorage に保存されます。`
            : '出展企業情報を読み込んでいます。'; */
    }

    // サーバー側の訪問履歴は管理者向けに限定するため、公開ページでは取得しません。

    loadCompanyMaster().then(master => {
        locations = master;
        renderStampCards();
        renderStampSheet();
        renderStampState();

        if (started && stampSection) {
            requestAnimationFrame(() => {
                stampSection.scrollIntoView({ behavior: "auto", block: "start" });
            });
        }
    });
}

function base64urlToBuffer(value) {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bufferToBase64url(value) {
    const bytes = new Uint8Array(value);
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function showPasskeyMessage(text, type = 'info') {
    const message = document.getElementById('passkey-message');
    if (!message) return;

    message.textContent = text;
    message.className = `message show ${type}`;
}

async function loadPasskeysList() {
    const list = document.getElementById('passkeys-list');
    if (!list) return;

    try {
        const response = await fetch('/api/auth/passkey/list', {
            credentials: 'include',
            cache: 'no-store'
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'パスキー一覧を取得できませんでした');
        }

        if (!data.passkeys?.length) {
            list.innerHTML = '<p style="color: #666;">登録済みのパスキーはありません。</p>';
            return;
        }

        list.innerHTML = data.passkeys.map(passkey => {
            const createdAt = new Date(passkey.created_at).toLocaleString('ja-JP');
            const lastUsedAt = passkey.last_used_at
                ? new Date(passkey.last_used_at).toLocaleString('ja-JP')
                : '未使用';

            return `
                <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; border:1px solid #ddd; border-radius:6px; padding:14px; margin-top:10px;">
                    <div>
                        <strong>${escapeHtml(passkey.name || '名称未設定')}</strong>
                        <div style="color:#666; font-size:12px; margin-top:5px;">登録: ${createdAt} / 最終使用: ${lastUsedAt}</div>
                    </div>
                    <button class="btn btn-danger" type="button" data-passkey-id="${passkey.id}">削除</button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-passkey-id]').forEach(button => {
            button.addEventListener('click', () => deletePasskey(Number(button.dataset.passkeyId)));
        });
    } catch (error) {
        console.error('パスキー一覧の読み込みに失敗しました', error);
        showPasskeyMessage(error.message, 'error');
    }
}

async function registerPasskey() {
    const passwordInput = document.getElementById('passkey-reauth-password');
    const nameInput = document.getElementById('passkey-name');
    const password = passwordInput?.value || '';
    const name = nameInput?.value.trim() || 'My Device';

    if (!password) {
        showPasskeyMessage('登録前に現在のパスワードを入力してください。', 'error');
        return;
    }

    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
        showPasskeyMessage('このブラウザーはパスキー登録に対応していません。', 'error');
        return;
    }

    const button = document.getElementById('register-passkey-btn');
    if (button) button.disabled = true;

    try {
        const reauthResponse = await fetch('/api/auth/passkey/reauth-password', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const reauthData = await reauthResponse.json();
        if (!reauthResponse.ok || !reauthData.ok) {
            throw new Error(reauthData.error || '本人確認に失敗しました');
        }

        const optionsResponse = await fetch('/api/auth/passkey/register/options', {
            method: 'POST',
            credentials: 'include'
        });
        const optionsData = await optionsResponse.json();
        if (!optionsResponse.ok || !optionsData.ok) {
            throw new Error(optionsData.error || '登録 options を取得できませんでした');
        }

        const options = optionsData.options;
        const credential = await navigator.credentials.create({
            publicKey: {
                ...options,
                challenge: base64urlToBuffer(options.challenge),
                user: {
                    ...options.user,
                    id: base64urlToBuffer(options.user.id)
                },
                excludeCredentials: (options.excludeCredentials || []).map(item => ({
                    ...item,
                    id: base64urlToBuffer(item.id)
                }))
            }
        });

        if (!credential) throw new Error('パスキー登録がキャンセルされました');

        const response = credential.response;
        const verifyResponse = await fetch('/api/auth/passkey/register/verify', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: credential.id,
                rawId: bufferToBase64url(credential.rawId),
                response: {
                    clientDataJSON: bufferToBase64url(response.clientDataJSON),
                    attestationObject: bufferToBase64url(response.attestationObject),
                    transports: response.getTransports?.() || []
                },
                name
            })
        });
        const verifyData = await verifyResponse.json();
        if (!verifyResponse.ok || !verifyData.ok) {
            throw new Error(verifyData.error || 'パスキー登録に失敗しました');
        }

        showPasskeyMessage('パスキーを登録しました。', 'success');
        passwordInput.value = '';
        nameInput.value = '';
        await loadPasskeysList();
    } catch (error) {
        console.error('パスキー登録に失敗しました', error);
        showPasskeyMessage(error.name === 'NotAllowedError' ? 'パスキー登録がキャンセルされました。' : error.message, 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

async function deletePasskey(passkeyId) {
    const password = window.prompt('本人確認のため、現在のパスワードを入力してください。');
    if (password === null) return;

    try {
        const response = await fetch('/api/auth/passkey/delete', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passkey_id: passkeyId, password })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'パスキーを削除できませんでした');
        }

        showPasskeyMessage('パスキーを削除しました。', 'success');
        await loadPasskeysList();
    } catch (error) {
        console.error('パスキー削除に失敗しました', error);
        showPasskeyMessage(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const registerButton = document.getElementById('register-passkey-btn');
    registerButton?.addEventListener('click', registerPasskey);
});