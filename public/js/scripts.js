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
})();

/* ---------- Footer year ---------- */
(() => {
    document.querySelectorAll('[data-year]').forEach((el) => {
        el.textContent = new Date().getFullYear();
    });
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
            status: 'DA NANG, VIETNAM · UTC+7 · OPEN TO FREELANCE',
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
            status: 'ဒါနန်း၊ ဗီယက်နမ် · UTC+7 · FREELANCE အလုပ်များ လက်ခံပါသည်',
            about: 'မင်္ဂလာပါဗျ။ ကျွန်တော်သည် MOBILE PROJECT တွေရေးတဲ့ SOFTWARE ENGINEER တစ်ယောက်ပါဗျ။ ကျွန်တော့်၏ လုပ်သက် ၃ နှစ်အတွင့် လုံးဆုံသော PROJECT များကို ရေးခဲ့တယ်ဗျ။ အသေးစိတ်ပြောရမယ်ဆိုရင် HR နဲ့ပက်သက်တဲ့ APP၊ E-COMMERCE နဲ့ပက်သက်တဲ့ APP၊ PRODUCTIVITY နဲ့ပက်သက်တဲ့ APP၊ IN HOUSE APP များ နှင့် UTILITY နဲ့ ပက်သက်တဲ့ APP များကိုရေးခဲ့ပါတယ်ဗျ။ ကျွန်တော်အခုနောက်ပိုင်း ANDROID NATIVE DEVELOPMENT ကိုလေ့လာရင်း PROJECT များမှာပါ အကောင်အထည်ဖော်သွားဖို့ လုပ်သွားပါမယ်။ သင့်စီမှာ APP တစ်ခုအတွက်အကြံအညဏ်အကောင်းရှိလျှင် ကျွန်တော့်စီလာ၍ ဆွေးနွေး သုံးသပ်ခါ အတူတူ ရေးဖို့အတွက် ကမ်းလှမ်းပါတယ်ဗျ။',
        },
    };

    const root = document.documentElement;
    const group = document.querySelector('.lang-switch');
    if (!group) return;

    const indicator = group.querySelector('.lang-indicator');
    const options = [...group.querySelectorAll('.lang-option')];
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
        const active = options.find((o) => o.getAttribute('aria-pressed') === 'true');
        if (!active) return;
        indicator.style.width = `${active.offsetWidth}px`;
        indicator.style.transform = `translateX(${active.offsetLeft}px)`;
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
    requestAnimationFrame(() => group.classList.add('is-ready'));

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
            window.dispatchEvent(new Event('languagechange-ui'));
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

/* ---------- Cute morphing cursor ---------- */
(() => {
    // Only for a real mouse/trackpad; phones and tablets keep their normal touch behavior
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    const LINK = 'a, button';
    const PLAIN = '[data-cursor="plain"]'; // keeps the normal arrow (e.g. project cards)
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
    let down = false;

    function releaseLink() {
        if (link) link.style.translate = '';
        pull.x = 0;
        pull.y = 0;
        link = null;
    }

    function getTarget() {
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

    window.addEventListener('mousemove', (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        root.classList.add('cursor-visible');

        // The arrow follows the pointer exactly, with its tip on the hotspot
        arrow.style.transform = `translate3d(${pointer.x - TIP_X}px, ${pointer.y - TIP_Y}px, 0)`;

        const plain = e.target.closest(PLAIN);
        const nextLink = plain ? null : e.target.closest(LINK);
        if (nextLink !== link) {
            releaseLink();
            link = nextLink;
        }

        const text = !link && !plain && e.target.closest(TEXT);
        textHeight = text
            ? Math.round((parseFloat(getComputedStyle(text).fontSize) || 14) * 1.3)
            : 0;

        root.classList.toggle('cursor-hide-arrow', Boolean(link || textHeight));

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
        down = true;
        root.classList.add('cursor-down');
    });
    window.addEventListener('mouseup', () => {
        down = false;
        root.classList.remove('cursor-down');
    });

    document.addEventListener('mouseleave', () => {
        root.classList.remove('cursor-visible');
        releaseLink();
    });
    window.addEventListener('blur', () => root.classList.remove('cursor-visible'));

    function loop() {
        const t = getTarget();
        for (const key of ['x', 'y', 'w', 'h', 'r']) {
            cur[key] += (t[key] - cur[key]) * EASE;
        }

        // Stay behind the button while on it, and while shrinking back out of its shape
        const behind = Boolean(link) || (cur.w > 4 && cur.h < cur.w * 2);
        root.classList.toggle('cursor-on-link', behind);

        cursor.style.width = `${cur.w}px`;
        cursor.style.height = `${cur.h}px`;
        cursor.style.borderRadius = `${cur.r}px`;
        cursor.style.transform = `translate3d(${cur.x - cur.w / 2}px, ${cur.y - cur.h / 2}px, 0)`;

        requestAnimationFrame(loop);
    }
    loop();
})();