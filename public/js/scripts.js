/* ---------- Animated text selection ---------- */
(() => {
    const root = document.documentElement;
    const body = document.body;

    const layer = document.createElement('div');
    layer.className = 'selection-layer';
    layer.setAttribute('aria-hidden', 'true');
    body.appendChild(layer);

    root.classList.add('has-selection-layer');

    let boxes = new Map(); // line key -> box element
    let frame = 0;

    function isBackward(selection) {
        const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
        if (!anchorNode || !focusNode) return false;
        if (anchorNode === focusNode) return focusOffset < anchorOffset;
        return Boolean(
            anchorNode.compareDocumentPosition(focusNode) & Node.DOCUMENT_POSITION_PRECEDING
        );
    }

    function getTextRects(range) {
        const container = range.commonAncestorContainer;

        if (container.nodeType === Node.TEXT_NODE) {
            return [...range.getClientRects()];
        }

        const rects = [];
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) =>
                range.intersectsNode(node) && node.textContent.trim()
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT,
        });

        const sub = document.createRange();
        while (walker.nextNode()) {
            const node = walker.currentNode;
            sub.selectNodeContents(node);
            if (node === range.startContainer) sub.setStart(node, range.startOffset);
            if (node === range.endContainer) sub.setEnd(node, range.endOffset);
            rects.push(...sub.getClientRects());
        }

        return rects;
    }

    function update() {
        frame = 0;

        const selection = document.getSelection();
        const rects = [];

        if (selection && !selection.isCollapsed) {
            for (let i = 0; i < selection.rangeCount; i++) {
                rects.push(...getTextRects(selection.getRangeAt(i)));
            }
        }

        const backward = selection ? isBackward(selection) : false;
        const origin = body.getBoundingClientRect();

        const items = rects
            .filter((r) => r.width > 0 && r.height > 0)
            .map((r) => ({
                left: r.left - origin.left,
                top: r.top - origin.top,
                width: r.width,
                height: r.height,
            }))
            .sort((a, b) => a.top - b.top || a.left - b.left);

        const next = new Map();
        const perLine = new Map();

        items.forEach((item) => {
            const line = Math.round(item.top);
            const n = perLine.get(line) ?? 0;
            perLine.set(line, n + 1);
            const key = `${line}:${n}`;

            let box = boxes.get(key);

            if (!box) {
                box = document.createElement('div');
                box.className = 'selection-box';
                box.classList.toggle('from-right', backward);
                layer.appendChild(box);
                requestAnimationFrame(() => box.classList.add('is-visible'));
            }

            box.style.left = `${item.left}px`;
            box.style.top = `${item.top}px`;
            box.style.width = `${item.width}px`;
            box.style.height = `${item.height}px`;

            next.set(key, box);
        });

        boxes.forEach((box, key) => {
            if (next.has(key)) return;
            box.classList.toggle('from-right', !backward);
            box.classList.remove('is-visible');
            setTimeout(() => box.remove(), 250);
        });

        boxes = next;
    }

    function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
    }

    document.addEventListener('selectionchange', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('languagechange-ui', schedule);
    window.addEventListener('layoutchange-ui', schedule);
})();

/* ---------- Footer year ---------- */
(() => {
    document.querySelectorAll('[data-year]').forEach((el) => {
        el.textContent = new Date().getFullYear();
    });
})();

/* ---------- Theme switch ---------- */
(() => {
    const STORAGE_KEY = 'theme';
    const SUPPORTED = ['light', 'dark', 'system'];

    const root = document.documentElement;
    const metas = [...document.querySelectorAll('meta[name="theme-color"][data-scheme]')];

    function readSaved() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }

    function save(theme) {
        try {
            // System is the default: store nothing for it
            if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            /* storage unavailable: ignore */
        }
    }

    // Light and dark pin the theme; system removes the pin so the CSS follows prefers-color-scheme.
    // The browser UI color (theme-color) follows the same choice.
    function setTheme(theme) {
        if (theme === 'system') delete root.dataset.theme;
        else root.dataset.theme = theme;

        metas.forEach((meta) => {
            const scheme = meta.dataset.scheme;
            if (theme === 'system') meta.media = `(prefers-color-scheme: ${scheme})`;
            else meta.media = scheme === theme ? 'all' : 'not all';
        });
    }

    const saved = readSaved();
    let current = SUPPORTED.includes(saved) ? saved : 'system';
    setTheme(current); // the inline <head> script already set data-theme; this also syncs theme-color

    // Every theme switch on the page (footer, phone settings) shows the same choice
    const groups = [...document.querySelectorAll('.theme-switch')];
    if (!groups.length) return;

    const options = groups.flatMap((g) => [...g.querySelectorAll('.switch-option')]);

    function moveIndicator() {
        groups.forEach((group) => {
            const active = group.querySelector('.switch-option[aria-pressed="true"]');
            if (!active) return;
            const indicator = group.querySelector('.switch-indicator');
            indicator.style.width = `${active.offsetWidth}px`;
            indicator.style.transform = `translateX(${active.offsetLeft}px)`;
        });
    }

    function press(theme) {
        options.forEach((o) => {
            o.setAttribute('aria-pressed', String(o.dataset.themeOption === theme));
        });
        moveIndicator();
    }

    options.forEach((option) => {
        option.addEventListener('click', () => {
            const theme = option.dataset.themeOption;
            if (theme === current) return;
            current = theme;
            press(theme);

            // Swap every color in one step (see .is-theme-switching in styles.css)
            root.classList.add('is-theme-switching');
            setTheme(theme);
            void document.body.offsetHeight; // commit the new colors with transitions off
            requestAnimationFrame(() => root.classList.remove('is-theme-switching'));

            save(theme);
        });
    });

    // First paint: place the indicators without animation, then show the switches and enable sliding
    press(current);
    requestAnimationFrame(() => groups.forEach((g) => g.classList.add('is-ready')));

    // Re-measure once the web font loads and on resize
    if (document.fonts) document.fonts.ready.then(moveIndicator);
    window.addEventListener('resize', moveIndicator);
})();

/* ---------- Language switch ---------- */
(() => {
    const STORAGE_KEY = 'lang';
    const SUPPORTED = ['en', 'my'];
    const FADE_MS = 200;    // old text fades out
    const RESIZE_MS = 320;  // new text fades in and height eases

    const translations = {
        en: {
            title: 'Thet Maung',
            name: 'THET MAUNG',
            email: 'EMAIL',
            resume: 'RESUME',
            projects: 'PROJECTS',
            stack: 'STACK',
            learning: 'LEARNING',
            comingSoon: 'COMING SOON',
            projectsEmpty: 'Nothing to show here yet. I’m building a few personal projects and will add them as they ship. In the meantime, my code lives on GitHub.',
            status: 'DA NANG, VIETNAM · UTC+7 · OPEN TO FREELANCE',
            // Phone settings. No Burmese yet in `my`: until it is added, these stay in English
            settings: 'SETTINGS',
            theme: 'THEME',
            language: 'LANGUAGE',
            about: 'I’m a software engineer who builds mobile apps people actually enjoy using. For the past 3 years I’ve worked with Flutter and React Native on HR management, e-commerce, productivity and utility apps, caring as much about performance as I do about the details of the interface. Right now I’m going native, learning Android development with Kotlin and Jetpack Compose. If you have an idea you’d like to bring to life, I’d love to hear about it and help you build it.',
        },
        my: {
            title: 'သက်မောင်',
            name: 'သက်မောင်',
            email: 'အီးမေးလ်',
            resume: 'ကိုယ်ရေးအကျဉ်း',
            projects: 'ပရောဂျက်များ',
            stack: 'နည်းပညာများ',
            learning: 'လေ့လာနေဆဲ',
            comingSoon: 'မကြာမီ',
            projectsEmpty: 'ပြသရန် ပရောဂျက်များ မရှိသေးပါ။ ကိုယ်ပိုင် ပရောဂျက်အချို့ကို ရေးနေဆဲဖြစ်ပြီး ပြီးစီးသည်နှင့် ဤနေရာတွင် ထည့်ပါမည်။ ယခုအချိန်တွင် ကျွန်တော့် code များကို GitHub တွင် ကြည့်နိုင်ပါသည်။',
            status: 'ဒါနန်း၊ ဗီယက်နမ် · UTC+7 · FREELANCE အလုပ်များ လက်ခံပါသည်',
            about: 'မင်္ဂလာပါဗျ။ ကျွန်တော်သည် MOBILE PROJECT တွေရေးတဲ့ SOFTWARE ENGINEER တစ်ယောက်ပါဗျ။ ကျွန်တော့်၏ လုပ်သက် ၃ နှစ်အတွင့် လုံးဆုံသော PROJECT များကို ရေးခဲ့တယ်ဗျ။ အသေးစိတ်ပြောရမယ်ဆိုရင် HR နဲ့ပက်သက်တဲ့ APP၊ E-COMMERCE နဲ့ပက်သက်တဲ့ APP၊ PRODUCTIVITY နဲ့ပက်သက်တဲ့ APP၊ IN HOUSE APP များ နှင့် UTILITY နဲ့ ပက်သက်တဲ့ APP များကိုရေးခဲ့ပါတယ်ဗျ။ ကျွန်တော်အခုနောက်ပိုင်း ANDROID NATIVE DEVELOPMENT ကိုလေ့လာရင်း PROJECT များမှာပါ အကောင်အထည်ဖော်သွားဖို့ လုပ်သွားပါမယ်။ သင့်စီမှာ APP တစ်ခုအတွက်အကြံအညဏ်အကောင်းရှိလျှင် ကျွန်တော့်စီလာ၍ ဆွေးနွေး သုံးသပ်ခါ အတူတူ ရေးဖို့အတွက် ကမ်းလှမ်းပါတယ်ဗျ။',
        },
    };

    const root = document.documentElement;
    // Every language switch on the page (footer, phone settings) shows the same choice
    const groups = [...document.querySelectorAll('.lang-switch')];
    if (!groups.length) return;

    const options = groups.flatMap((g) => [...g.querySelectorAll('.switch-option')]);
    const targets = [...document.querySelectorAll('[data-i18n]')];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let busy = false;

    function readSaved() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }

    function save(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch {
            /* storage unavailable: ignore */
        }
    }

    function detect() {
        const saved = readSaved();
        if (SUPPORTED.includes(saved)) return saved;

        const browser = (navigator.languages || [navigator.language])
            .map((l) => l.slice(0, 2).toLowerCase())
            .find((l) => SUPPORTED.includes(l));

        return browser || 'en';
    }

    function moveIndicator() {
        groups.forEach((group) => {
            const active = group.querySelector('.switch-option[aria-pressed="true"]');
            if (!active) return;
            const indicator = group.querySelector('.switch-indicator');
            indicator.style.width = `${active.offsetWidth}px`;
            indicator.style.transform = `translateX(${active.offsetLeft}px)`;
        });
    }

    function setText(lang) {
        const dict = translations[lang];
        targets.forEach((el) => {
            const value = dict[el.dataset.i18n];
            if (value !== undefined) el.textContent = value;
        });
        if (dict.title) document.title = dict.title;
        window.dispatchEvent(new Event('languagechange-ui'));
    }

    function apply(lang, animate) {
        options.forEach((o) => {
            o.setAttribute('aria-pressed', String(o.dataset.lang === lang));
        });
        moveIndicator();

        if (!animate || reduceMotion.matches) {
            root.lang = lang;
            setText(lang);
            return;
        }

        busy = true;

        // 1. Old text drifts up and fades out
        targets.forEach((el) => el.classList.add('is-switching'));

        setTimeout(() => {
            // 2. Swap language and text, then place the new text just below, invisible
            const before = targets.map((el) => el.offsetHeight);
            root.lang = lang;
            setText(lang);

            targets.forEach((el, i) => {
                const after = el.offsetHeight;
                el.classList.remove('is-switching');
                el.classList.add('is-entering');

                // Hold the old height so it can ease to the new one
                if (Math.abs(after - before[i]) > 1) {
                    el.classList.add('is-resizing');
                    el.style.height = `${before[i]}px`;
                    el.dataset.toHeight = after;
                }
            });

            void document.body.offsetHeight; // commit the starting state

            // 3. New text rises in, height eases to fit
            requestAnimationFrame(() => {
                targets.forEach((el) => {
                    el.classList.remove('is-entering');
                    if (el.dataset.toHeight) {
                        el.style.height = `${el.dataset.toHeight}px`;
                        delete el.dataset.toHeight;
                    }
                });

                // 4. Clean up
                setTimeout(() => {
                    targets.forEach((el) => {
                        el.classList.remove('is-resizing');
                        el.style.height = '';
                    });
                    busy = false;
                    window.dispatchEvent(new Event('languagechange-ui'));
                }, RESIZE_MS);
            });
        }, FADE_MS);
    }

    options.forEach((option) => {
        option.addEventListener('click', () => {
            const lang = option.dataset.lang;
            if (busy || lang === root.lang) return;
            apply(lang, true);
            save(lang);
        });
    });

    // First paint: place everything without animation, then enable sliding
    apply(detect(), false);
    root.classList.remove('i18n-pending'); // set by the inline script in <head>
    requestAnimationFrame(() => groups.forEach((g) => g.classList.add('is-ready')));

    // Re-measure once the web font loads (it changes button widths) and on resize
    if (document.fonts) document.fonts.ready.then(moveIndicator);
    window.addEventListener('resize', moveIndicator);
})();

/* ---------- Carousels (projects, stack) ---------- */
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pad = (n) => String(n).padStart(2, '0');

    function initCarousel(section) {
        const track = section.querySelector('[data-carousel-track]');
        const prev = section.querySelector('[data-carousel-prev]');
        const next = section.querySelector('[data-carousel-next]');
        const current = section.querySelector('[data-carousel-current]');
        const total = section.querySelector('[data-carousel-total]');
        if (!track || !prev || !next) return;

        const cards = [...track.children];
        if (total) total.textContent = pad(cards.length);

        // Distance from one card to the next
        function step() {
            const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            return cards[0].offsetWidth + gap;
        }

        function update() {
            const max = track.scrollWidth - track.clientWidth;
            const atStart = track.scrollLeft <= 2;
            const atEnd = track.scrollLeft >= max - 2;
            const index = atEnd ? cards.length : Math.round(track.scrollLeft / step()) + 1;

            if (current) current.textContent = pad(index);
            prev.disabled = atStart;
            next.disabled = atEnd;

            // Keep the selection highlight aligned while cards move
            window.dispatchEvent(new Event('layoutchange-ui'));
        }

        function go(direction) {
            track.scrollBy({
                left: direction * step(),
                behavior: reduceMotion.matches ? 'auto' : 'smooth',
            });
        }

        prev.addEventListener('click', () => go(-1));
        next.addEventListener('click', () => go(1));

        let frame = 0;
        track.addEventListener('scroll', () => {
            if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); });
        }, { passive: true });
        window.addEventListener('resize', update);

        update();
    }

    document.querySelectorAll('[data-carousel]').forEach(initCarousel);
})();

/* ---------- Phone: Android-style home screen (wide screens) ---------- */
(() => {
    const phone = document.querySelector('.phone');
    if (!phone) return;

    const root = document.documentElement;
    const screen = phone.querySelector('.phone-screen');
    const home = phone.querySelector('.phone-home');
    const views = [...phone.querySelectorAll('.phone-view')];
    const power = phone.querySelector('.phone-power');
    const wake = phone.querySelector('.phone-off');
    const homeBar = phone.querySelector('.phone-home-bar');
    const times = [...phone.querySelectorAll('[data-phone-time]')];
    const date = phone.querySelector('[data-phone-date]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let openView = null;
    let opener = null;

    // CSS scales the phone down on short screens: convert viewport px to the screen's own px
    function toScreen(x, y) {
        const s = screen.getBoundingClientRect();
        const k = s.width / screen.offsetWidth || 1;
        return { x: (x - s.left) / k, y: (y - s.top) / k };
    }

    /* Clock: Da Nang time (UTC+7, no daylight saving), whatever the visitor's time zone */
    const OFFSET_MS = 7 * 60 * 60 * 1000;
    const pad = (n) => String(n).padStart(2, '0');
    let tickTimer = 0;

    function tick() {
        const now = new Date(Date.now() + OFFSET_MS); // read with the UTC getters
        const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
        times.forEach((el) => {
            el.textContent = time;
        });

        // Weekday and month in the page language, with Latin digits. Browsers without Burmese date
        // data would fall back to a US format, so use the British one in that case too
        const burmese = root.lang === 'my' && Intl.DateTimeFormat.supportedLocalesOf('my').length > 0;
        const locale = burmese ? 'my-u-nu-latn' : 'en-GB';
        let day;
        try {
            day = new Intl.DateTimeFormat(locale, {
                timeZone: 'UTC',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            }).format(now);
        } catch {
            day = now.toUTCString().slice(0, 11);
        }
        date.textContent = `${day.toUpperCase()} · UTC+7`;

        clearTimeout(tickTimer);
        tickTimer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); // just after the next minute
    }

    /* Apps: only the open one (or home) can take focus; nothing while the screen is off */
    function syncInert() {
        const off = screen.classList.contains('is-off');
        home.inert = off || Boolean(openView);
        views.forEach((view) => {
            view.inert = off || view !== openView;
        });
        homeBar.inert = off;
    }

    function open(name, from) {
        const view = views.find((v) => v.dataset.phoneView === name);
        if (!view || openView) return;

        // Grow out of the tapped icon
        const icon = from.querySelector('.phone-icon').getBoundingClientRect();
        const origin = toScreen(icon.left + icon.width / 2, icon.top + icon.height / 2);
        view.style.transformOrigin = `${origin.x}px ${origin.y}px`;

        openView = view;
        opener = from;
        view.classList.add('is-open');
        screen.classList.add('has-app');
        syncInert();
        view.querySelector('[data-phone-back]').focus({ preventScroll: true });
    }

    function close() {
        if (!openView) return;
        const from = opener;
        openView.classList.remove('is-open');
        screen.classList.remove('has-app');
        openView = null;
        opener = null;
        syncInert();
        from.focus({ preventScroll: true });
    }

    phone.querySelectorAll('[data-phone-open]').forEach((app) => {
        app.addEventListener('click', () => open(app.dataset.phoneOpen, app));
    });
    phone.querySelectorAll('[data-phone-back]').forEach((back) => {
        back.addEventListener('click', close);
    });
    phone.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && openView) close();
    });

    /* Home bar: tap to go home, or drag it up and the app follows before closing */
    let drag = null;

    homeBar.addEventListener('pointerdown', (e) => {
        if (!openView) return;
        drag = { start: toScreen(e.clientX, e.clientY).y, view: openView };
        drag.view.classList.add('is-dragging');
        homeBar.setPointerCapture(e.pointerId);
    });

    homeBar.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dy = Math.min(0, toScreen(e.clientX, e.clientY).y - drag.start);
        drag.view.style.translate = `0 ${dy}px`;
        drag.view.style.scale = String(Math.max(0.6, 1 + dy / 600));
    });

    // Release: drop the drag styles; the click that follows closes the app from where it was
    function endDrag() {
        if (!drag) return;
        drag.view.classList.remove('is-dragging');
        drag.view.style.translate = '';
        drag.view.style.scale = '';
        drag = null;
    }

    homeBar.addEventListener('pointerup', endDrag);
    homeBar.addEventListener('pointercancel', endDrag);
    homeBar.addEventListener('click', close);

    /* Power key: screen off shows an always-on clock; tap the screen (or the key) to wake */
    function setPower(on) {
        screen.classList.toggle('is-off', !on);
        power.setAttribute('aria-pressed', String(on));
        syncInert();
    }

    power.addEventListener('click', () => setPower(screen.classList.contains('is-off')));
    wake.addEventListener('click', () => {
        const hadFocus = document.activeElement === wake;
        setPower(true);
        if (hadFocus) power.focus({ preventScroll: true }); // the wake button is gone: keep focus here
    });

    /* Tap feedback: a ripple where the screen was touched */
    screen.addEventListener('pointerdown', (e) => {
        if (reduceMotion.matches) return;
        const p = toScreen(e.clientX, e.clientY);
        const ripple = document.createElement('span');
        ripple.className = 'phone-ripple';
        ripple.style.left = `${p.x}px`;
        ripple.style.top = `${p.y}px`;
        screen.append(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    });

    syncInert();
    tick();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tick(); // timers are throttled in background tabs
    });
    window.addEventListener('languagechange-ui', tick);
    phone.classList.add('is-ready');
})();

/* ---------- Cute morphing cursor ---------- */
(() => {
    // Only for a real mouse/trackpad; phones and tablets keep their normal touch behavior
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    const LINK = 'a, button';
    const PLAIN = '[data-cursor="plain"]'; // keeps the normal arrow (e.g. project cards)
    const TOUCH = '[data-cursor="touch"]'; // a touch dot instead (the phone screen)
    const TEXT = 'p, h1, h2, h3, li';
    const TIP_X = 3;                       // arrow tip (hotspot) inside the 24px SVG
    const TIP_Y = 2.5;
    const EASE = reduceMotion ? 1 : 0.25;  // 0–1, lower = smoother/lazier morph
    const PULL = reduceMotion ? 0 : 0.15;  // how far buttons lean toward the pointer

    // Morphing blob
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');

    // Arrow pointer
    const arrow = document.createElement('div');
    arrow.className = 'cursor-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    const ARROW = 'M5 4 L19.5 11 L12.2 13 L9.8 20 Z';
    arrow.innerHTML =
        `<svg viewBox="0 0 24 24">
            <path class="arrow-outline" d="${ARROW}"/>
            <path class="arrow-fill" d="${ARROW}"/>
        </svg>`;

    document.body.append(cursor, arrow);
    root.classList.add('has-custom-cursor');

    const pointer = { x: -100, y: -100 };
    const cur = { x: -100, y: -100, w: 0, h: 0, r: 0 };
    const pull = { x: 0, y: 0 };

    let link = null;
    let textHeight = 0;
    let touching = false;
    let down = false;

    function releaseLink() {
        if (link) link.style.translate = '';
        pull.x = 0;
        pull.y = 0;
        link = null;
    }

    function getTarget() {
        // Touch dot, a little smaller while pressed
        if (touching) {
            const d = down ? 20 : 26;
            return { x: pointer.x, y: pointer.y, w: d, h: d, r: d / 2 };
        }

        // Morph into the hovered button's shape
        if (link) {
            const b = link.getBoundingClientRect();
            const scale = down ? 0.94 : 1;
            return {
                x: b.left + b.width / 2,
                y: b.top + b.height / 2,
                w: b.width * scale,
                h: b.height * scale,
                r: (b.height * scale) / 2,
            };
        }

        // Thin text bar over text
        if (textHeight) {
            return { x: pointer.x, y: pointer.y, w: 2, h: textHeight, r: 1 };
        }

        // Normal: blob shrinks away into the arrow tip
        return { x: pointer.x, y: pointer.y, w: 0, h: 0, r: 0 };
    }

    // The loop sleeps once the blob has settled and wakes on anything that can move its target.
    // A hovered button can still move after the last event (magnetic pull transition, page or
    // carousel scroll, text resizing after a language switch), so it keeps running for a while.
    const SETTLE_MS = 1000; // longer than any transition that moves a hovered button
    let running = false;
    let lastWake = 0;

    function wake() {
        lastWake = performance.now();
        if (running) return;
        running = true;
        requestAnimationFrame(loop);
    }

    window.addEventListener('mousemove', (e) => {
        wake();
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        root.classList.add('cursor-visible');

        // The arrow follows the pointer exactly, with its tip on the hotspot
        arrow.style.transform = `translate3d(${pointer.x - TIP_X}px, ${pointer.y - TIP_Y}px, 0)`;

        touching = Boolean(e.target.closest(TOUCH));
        const plain = touching || e.target.closest(PLAIN);
        const nextLink = plain ? null : e.target.closest(LINK);
        if (nextLink !== link) {
            releaseLink();
            link = nextLink;
        }

        const text = !link && !plain && e.target.closest(TEXT);
        textHeight = text
            ? Math.round((parseFloat(getComputedStyle(text).fontSize) || 14) * 1.3)
            : 0;

        root.classList.toggle('cursor-touch', touching);
        root.classList.toggle('cursor-hide-arrow', Boolean(link || textHeight || touching));

        // Magnetic pull: the button leans toward the pointer
        if (link && PULL) {
            const b = link.getBoundingClientRect();
            const cx = b.left + b.width / 2 - pull.x;
            const cy = b.top + b.height / 2 - pull.y;
            pull.x = (pointer.x - cx) * PULL;
            pull.y = (pointer.y - cy) * PULL;
            link.style.translate = `${pull.x}px ${pull.y}px`;
        }
    }, { passive: true });

    window.addEventListener('mousedown', () => {
        wake();
        down = true;
        root.classList.add('cursor-down');
    });
    window.addEventListener('mouseup', () => {
        wake();
        down = false;
        root.classList.remove('cursor-down');
    });

    document.addEventListener('mouseleave', () => {
        wake();
        root.classList.remove('cursor-visible');
        releaseLink();
    });
    window.addEventListener('blur', () => root.classList.remove('cursor-visible'));

    // Things that move a hovered button without a mouse event (scroll doesn't bubble: capture it)
    window.addEventListener('scroll', wake, { capture: true, passive: true });
    window.addEventListener('resize', wake);
    window.addEventListener('languagechange-ui', wake);
    window.addEventListener('layoutchange-ui', wake);
    if (document.fonts) document.fonts.addEventListener('loadingdone', wake);

    function loop(now) {
        const t = getTarget();
        let settled = true;
        for (const key of ['x', 'y', 'w', 'h', 'r']) {
            cur[key] += (t[key] - cur[key]) * EASE;
            if (Math.abs(t[key] - cur[key]) > 0.01) settled = false;
        }

        const idle = settled && now - lastWake > SETTLE_MS;
        if (idle) Object.assign(cur, t); // land exactly on the target before sleeping

        // Stay behind the button while on it, and while shrinking back out of its shape
        // (never for the touch dot: it has to show on top of the phone screen)
        const behind = Boolean(link) || (!touching && cur.w > 4 && cur.h < cur.w * 2);
        root.classList.toggle('cursor-on-link', behind);

        cursor.style.width = `${cur.w}px`;
        cursor.style.height = `${cur.h}px`;
        cursor.style.borderRadius = `${cur.r}px`;
        cursor.style.transform = `translate3d(${cur.x - cur.w / 2}px, ${cur.y - cur.h / 2}px, 0)`;

        if (idle) {
            running = false;
            return;
        }
        requestAnimationFrame(loop);
    }
    wake();
})();