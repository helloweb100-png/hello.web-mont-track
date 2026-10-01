/* ==========================================================================
   MONTRACK — script.js
   --------------------------------------------------------------------------
   Módulos (todos independientes y tolerantes a fallos):
    01. Utilidades y estado global
    02. Preloader
    03. Scroll suave (Lenis) + bus de scroll
    04. Header, menú móvil, scroll-spy, progreso
    05. Hero: rotador, escenario 3D, canvas de partículas/rejilla
    06. Reveals por scroll (CSS + IntersectionObserver) y titulares
    07. Efectos GSAP: texto que se enciende, catálogo anclado, proceso, contadores
    08. Marquees (WAAPI) con velocidad ligada al scroll
    09. Industrias, FAQ, comparativa
    10. Galería + lightbox, video
    11. Formulario → WhatsApp
    12. Cursor, magnetismo, tilt, WhatsApp flotante
   ========================================================================== */
(() => {
    'use strict';

    /* ======================================================================
       01. UTILIDADES Y ESTADO
       ====================================================================== */
    const root = document.documentElement;
    root.classList.add('js-ready');

    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const rnd = (a, b) => a + Math.random() * (b - a);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    const WA_NUMBER = '525549915436';

    const state = { lenis: null, ready: false, heroFX: null };
    let setMenu = () => {};

    if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

    /* Bloqueo de scroll con varias razones (preloader, menú, lightbox) */
    const locks = new Set();
    function lockScroll(key) {
        locks.add(key);
        root.classList.add('is-locked');
        if (state.lenis) state.lenis.stop();
    }
    function unlockScroll(key) {
        locks.delete(key);
        if (locks.size) return;
        root.classList.remove('is-locked');
        if (state.lenis) state.lenis.start();
    }

    /* Bus de scroll unificado (Lenis o nativo) */
    const bus = { y: window.scrollY, v: 0, dir: 0, subs: new Set() };
    function emitScroll(y, v = 0, dir = 0) {
        bus.y = y; bus.v = v; bus.dir = dir;
        bus.subs.forEach(fn => fn(bus));
    }

    /* ======================================================================
       02. PRELOADER · el pictograma se "llena" al cargar la página
       ====================================================================== */
    function initPreloader() {
        const el = $('#preloader');
        if (!el) { return Promise.resolve(); }

        lockScroll('preloader');
        const num = $('#pl-num');
        const status = $('#pl-status');
        const msgs = ['Inicializando operación', 'Cargando catálogo', 'Alineando racks', 'Calibrando montacargas', 'Listo para operar'];
        const minTime = reduceMotion ? 350 : 2400;
        const t0 = performance.now();
        let shown = 0, loaded = false, lastMsg = -1, lastNum = -1;

        const pageLoaded = new Promise(res => {
            if (document.readyState === 'complete') res();
            else window.addEventListener('load', res, { once: true });
        });
        const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
        Promise.all([pageLoaded, fontsReady]).then(() => { loaded = true; });
        setTimeout(() => { loaded = true; }, 7000); // salvaguarda

        const easeOut = t => 1 - Math.pow(1 - t, 3);

        return new Promise(resolve => {
            function frame(now) {
                const timeP = clamp((now - t0) / minTime, 0, 1);
                const cap = loaded ? 100 : 91;
                const want = Math.min(easeOut(timeP) * 100, cap);
                shown = lerp(shown, want, .14);
                if (loaded && timeP >= 1 && shown > 99.3) shown = 100;

                const n = Math.round(shown);
                if (n !== lastNum) {
                    lastNum = n;
                    num.textContent = pad(n, 3);
                    el.style.setProperty('--pn', shown.toFixed(2));
                }
                const m = Math.min(msgs.length - 1, Math.floor(shown / (100 / msgs.length)));
                if (m !== lastMsg) { lastMsg = m; status.textContent = msgs[m]; }

                if (shown >= 100) { leave(); return; }
                requestAnimationFrame(frame);
            }

            function leave() {
                el.style.setProperty('--pn', 100);
                el.setAttribute('aria-busy', 'false');
                setTimeout(() => {
                    el.classList.add('is-leaving');
                    state.ready = true;
                    root.classList.add('is-ready');
                    unlockScroll('preloader');
                    if (hasGSAP) ScrollTrigger.refresh();
                    resolve();
                    setTimeout(() => el.classList.add('is-gone'), 1800);
                }, 380);
            }
            requestAnimationFrame(frame);
        });
    }

    /* ======================================================================
       03. SCROLL SUAVE (Lenis)
       ====================================================================== */
    function initScroll() {
        if (!reduceMotion && typeof window.Lenis !== 'undefined') {
            const lenis = new Lenis({
                duration: 1.2,
                easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                smoothWheel: true,
                wheelMultiplier: .92
            });
            state.lenis = lenis;
            lenis.on('scroll', l => emitScroll(l.scroll, l.velocity, l.direction));
            if (hasGSAP) {
                lenis.on('scroll', ScrollTrigger.update);
                gsap.ticker.add(time => lenis.raf(time * 1000));
                gsap.ticker.lagSmoothing(0);
            } else {
                const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
                requestAnimationFrame(raf);
            }
            if (locks.size) lenis.stop();
        } else {
            let last = window.scrollY;
            window.addEventListener('scroll', () => {
                const y = window.scrollY;
                emitScroll(y, y - last, Math.sign(y - last));
                last = y;
            }, { passive: true });
        }
    }

    function scrollToTarget(target, opts = {}) {
        const el = target === 0 ? 0 : (typeof target === 'string' ? $(target) : target);
        if (el === null || el === undefined) return;
        if (state.lenis) {
            state.lenis.scrollTo(el, {
                offset: opts.offset || 0,
                duration: opts.duration || 1.6,
                easing: t => 1 - Math.pow(1 - t, 4)
            });
        } else if (el === 0) {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        } else {
            el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
    }

    /* Enlaces ancla con scroll suave */
    function initAnchors() {
        document.addEventListener('click', e => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (!id || id === '#') return;
            const target = id === '#inicio' ? 0 : $(id);
            if (target === null) return;
            e.preventDefault();
            if (root.classList.contains('menu-open')) setMenu(false);
            try { history.replaceState(null, '', id); } catch (err) { /* file:// u otros contextos */ }
            scrollToTarget(target);
        });
    }

    /* ======================================================================
       04. HEADER · MENÚ · SPY · PROGRESO
       ====================================================================== */
    function initHeader() {
        const header = $('#header');
        const bar = $('#scroll-progress');
        if (!header) return;
        let lastY = 0;
        let max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const measure = () => { max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
        window.addEventListener('resize', measure);
        window.addEventListener('load', measure);
        if (hasGSAP) ScrollTrigger.addEventListener('refresh', measure);

        bus.subs.add(b => {
            const y = b.y;
            header.classList.toggle('is-scrolled', y > 24);
            const down = y > lastY + 4;
            const up = y < lastY - 4;
            if (y > 260 && down && !root.classList.contains('menu-open')) header.classList.add('is-hidden');
            else if (up || y < 260) header.classList.remove('is-hidden');
            if (down || up) lastY = y;
            if (bar) bar.style.transform = `scaleX(${clamp(y / max, 0, 1).toFixed(4)})`;
        });
    }

    function initMenu() {
        const burger = $('#burger');
        const menu = $('#menu');
        if (!burger || !menu) return;
        setMenu = open => {
            if (open === root.classList.contains('menu-open')) return;
            root.classList.toggle('menu-open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            menu.setAttribute('aria-hidden', String(!open));
            if (open) lockScroll('menu'); else unlockScroll('menu');
        };
        burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
    }

    function initSpy() {
        const links = $$('[data-spy]');
        if (!links.length || !('IntersectionObserver' in window)) return;
        const alias = { video: 'soluciones', comparativa: 'galeria' };
        const set = id => {
            links.forEach(l => {
                const on = l.dataset.spy === id;
                l.classList.toggle('is-active', on);
                if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
            });
        };
        const io = new IntersectionObserver(entries => {
            entries.forEach(en => { if (en.isIntersecting) set(alias[en.target.id] || en.target.id); });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main > section[id]').forEach(s => io.observe(s));
    }

    /* ======================================================================
       05. HERO
       ====================================================================== */
    function initHeroIntro() {
        // Índices y retardos que usa el CSS para la entrada escalonada
        $$('[data-hero="line"]').forEach((el, i) => el.style.setProperty('--i', i));
        $$('[data-hero="chip"], [data-hero="fade"]').forEach((el, i) => el.style.setProperty('--d', (.45 + i * .11).toFixed(2) + 's'));
        $$('.fchip').forEach((el, i) => el.style.setProperty('--fd', (i * .18).toFixed(2) + 's'));
    }

    /* Palabra rotatoria bajo el título */
    function initRotator() {
        const items = $$('.rotator__item');
        if (items.length < 2 || reduceMotion) return;
        let i = 0;
        setInterval(() => {
            if (document.hidden || !state.ready) return;
            const cur = items[i];
            i = (i + 1) % items.length;
            const next = items[i];
            cur.classList.remove('is-active');
            cur.classList.add('is-leaving');
            next.classList.remove('is-leaving');
            next.classList.add('is-active');
            setTimeout(() => {
                cur.style.transition = 'none';
                cur.classList.remove('is-leaving');
                void cur.offsetWidth;
                cur.style.transition = '';
            }, 800);
        }, 2600);
    }

    /* Carrusel del escenario con barras de progreso */
    function initStage() {
        const slides = $$('#stage-slides .slide');
        const bars = $$('.stage__bars .bar');
        const title = $('#stage-title');
        const tag = $('#stage-tag');
        const idx = $('#stage-idx');
        if (!slides.length) return;
        const DUR = 5500;
        let cur = 0;
        let timer = 0;

        const swap = el => {
            if (reduceMotion || !el.animate) return;
            el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
        };

        function go(n, auto) {
            cur = (n + slides.length) % slides.length;
            slides.forEach((s, i) => s.classList.toggle('is-active', i === cur));
            bars.forEach((b, i) => {
                b.classList.remove('is-active', 'is-done');
                if (i < cur) b.classList.add('is-done');
            });
            void bars[cur].offsetWidth;
            bars[cur].classList.add('is-active');
            const s = slides[cur];
            title.textContent = s.dataset.title;
            tag.textContent = s.dataset.tag;
            idx.textContent = pad(cur + 1);
            swap(title); swap(tag);
            clearTimeout(timer);
            if (!reduceMotion) timer = setTimeout(() => go(cur + 1, true), DUR);
        }

        bars.forEach((b, i) => b.addEventListener('click', () => go(i)));
        bars.forEach(b => b.style.setProperty('--dur', DUR + 'ms'));
        // Arranca cuando termina el preloader
        const start = () => go(0);
        if (state.ready) start(); else document.addEventListener('montrack:ready', start, { once: true });
    }

    /* Parallax / tilt del escenario según el puntero */
    function initHeroPointer() {
        const hero = $('#inicio');
        const stage = $('#stage');
        if (!hero || !stage || !finePointer || reduceMotion) return;
        const tgt = { rx: 0, ry: 0, mx: 0, my: 0 };
        const cur = { rx: 0, ry: 0, mx: 0, my: 0 };
        let raf = 0;

        function loop() {
            let moving = false;
            for (const k in cur) {
                cur[k] = lerp(cur[k], tgt[k], .09);
                if (Math.abs(cur[k] - tgt[k]) > .002) moving = true;
            }
            stage.style.setProperty('--rx', cur.rx.toFixed(3) + 'deg');
            stage.style.setProperty('--ry', cur.ry.toFixed(3) + 'deg');
            stage.style.setProperty('--mx', cur.mx.toFixed(3));
            stage.style.setProperty('--my', cur.my.toFixed(3));
            raf = moving ? requestAnimationFrame(loop) : 0;
        }
        const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

        hero.addEventListener('pointermove', e => {
            const r = stage.getBoundingClientRect();
            const px = clamp((e.clientX - r.left) / r.width, 0, 1) - .5;
            const py = clamp((e.clientY - r.top) / r.height, 0, 1) - .5;
            tgt.ry = px * 11;
            tgt.rx = -py * 9;
            tgt.mx = clamp((e.clientX / window.innerWidth - .5) * 2, -1, 1);
            tgt.my = clamp((e.clientY / window.innerHeight - .5) * 2, -1, 1);
            if (state.heroFX) {
                const hr = hero.getBoundingClientRect();
                state.heroFX.point((e.clientX - hr.left) / hr.width, (e.clientY - hr.top) / hr.height);
            }
            kick();
        });
        hero.addEventListener('pointerleave', () => {
            tgt.rx = tgt.ry = tgt.mx = tgt.my = 0;
            if (state.heroFX) state.heroFX.point(.5, .5);
            kick();
        });
    }

    /* Canvas: rejilla de piso en perspectiva + paquetes de carga + partículas */
    function initHeroCanvas() {
        const canvas = $('#hero-canvas');
        if (!canvas || !canvas.getContext) return;
        const hero = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const COLS = 22;
        let W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0, visible = true;
        let parts = [], crates = [];
        const mouse = { x: .5, y: .5, tx: .5, ty: .5 };

        // Sprite de brillo reutilizable (evita shadowBlur, que es costoso)
        const sprite = (() => {
            const s = 64, c = document.createElement('canvas');
            c.width = c.height = s;
            const g = c.getContext('2d');
            const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            gr.addColorStop(0, 'rgba(255,255,255,1)');
            gr.addColorStop(.25, 'rgba(255,215,80,.85)');
            gr.addColorStop(1, 'rgba(255,201,24,0)');
            g.fillStyle = gr; g.fillRect(0, 0, s, s);
            return c;
        })();

        const newCrate = p => ({ lane: Math.floor(rnd(-8, 8)) + .5, p: p === undefined ? 0 : p, sp: rnd(1.0e-4, 1.9e-4), w: rnd(.8, 1.15) });

        function seed() {
            const small = W < 700;
            parts = Array.from({ length: small ? 32 : 68 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(.7, 2.3), s: rnd(.12, .5), ph: rnd(0, 6.28), c: Math.random() }));
            crates = Array.from({ length: small ? 4 : 7 }, (_, i) => newCrate(i / (small ? 4 : 7)));
        }

        function resize() {
            const r = hero.getBoundingClientRect();
            dpr = Math.min(window.devicePixelRatio || 1, finePointer ? 2 : 1.5);
            W = r.width; H = r.height;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
            if (!raf) draw(0);
        }

        function draw(dt) {
            t += dt;
            ctx.clearRect(0, 0, W, H);
            mouse.x = lerp(mouse.x, mouse.tx, .05);
            mouse.y = lerp(mouse.y, mouse.ty, .05);

            const floorH0 = clamp(H * .2, 170, 300);
            const hz = H - floorH0 + (mouse.y - .5) * -20;
            const vx = W * .5 + (mouse.x - .5) * -80;
            const floorH = H - hz;
            const S = W / (COLS * .78);

            // Halo en el horizonte
            const halo = ctx.createRadialGradient(vx, hz, 0, vx, hz, W * .55);
            halo.addColorStop(0, 'rgba(255,201,24,.20)');
            halo.addColorStop(.5, 'rgba(255,150,30,.06)');
            halo.addColorStop(1, 'rgba(255,201,24,0)');
            ctx.save();
            ctx.translate(0, hz); ctx.scale(1, .42); ctx.translate(0, -hz);
            ctx.fillStyle = halo;
            ctx.fillRect(0, hz - W, W, W * 1.2);
            ctx.restore();

            // Líneas horizontales: avanzan hacia el espectador
            const rows = 14;
            const off = (t * .0011) % 1;
            ctx.lineWidth = 1;
            for (let i = 0; i < rows; i++) {
                const p = (i + off) / rows;
                const u = Math.pow(p, 2.35);
                const y = hz + floorH * u;
                ctx.strokeStyle = `rgba(255,201,24,${(.04 + .34 * u).toFixed(3)})`;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            }

            // Líneas radiales (carriles)
            const g1 = ctx.createLinearGradient(0, hz, 0, H);
            g1.addColorStop(0, 'rgba(255,255,255,0)');
            g1.addColorStop(1, 'rgba(255,255,255,.17)');
            ctx.strokeStyle = g1;
            ctx.beginPath();
            for (let j = -COLS; j <= COLS; j++) {
                if (j % 4 === 0) continue;
                ctx.moveTo(vx + j * 4, hz); ctx.lineTo(vx + j * S, H);
            }
            ctx.stroke();
            const g2 = ctx.createLinearGradient(0, hz, 0, H);
            g2.addColorStop(0, 'rgba(255,201,24,0)');
            g2.addColorStop(1, 'rgba(255,201,24,.5)');
            ctx.strokeStyle = g2;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let j = -COLS; j <= COLS; j += 4) { ctx.moveTo(vx + j * 4, hz); ctx.lineTo(vx + j * S, H); }
            ctx.stroke();
            ctx.lineWidth = 1;

            // Línea de horizonte
            const gh = ctx.createLinearGradient(0, 0, W, 0);
            gh.addColorStop(0, 'rgba(255,201,24,0)');
            gh.addColorStop(.5, 'rgba(255,201,24,.55)');
            gh.addColorStop(1, 'rgba(255,201,24,0)');
            ctx.fillStyle = gh;
            ctx.fillRect(0, hz - .5, W, 1.2);

            // Paquetes de carga viajando por los carriles
            crates.sort((a, b) => a.p - b.p);
            for (const c of crates) {
                c.p += c.sp * dt;
                if (c.p > 1.03) Object.assign(c, newCrate(0));
                const u = Math.pow(Math.max(c.p, 0), 2.35);
                if (u < .01) continue;
                const spread = 4 + (S - 4) * u;
                const x = vx + c.lane * spread;
                const y = hz + floorH * u;
                const w = spread * .62 * c.w;
                const h = w * .62;
                const a = clamp(u * 2.4, 0, 1) * .9;
                ctx.fillStyle = `rgba(255,201,24,${(a * .92).toFixed(3)})`;
                ctx.fillRect(x - w / 2, y - h, w, h);
                ctx.fillStyle = `rgba(0,0,0,${(a * .28).toFixed(3)})`;
                ctx.fillRect(x - w / 2, y - h * .32, w, h * .32);
                ctx.fillStyle = `rgba(255,255,255,${(a * .5).toFixed(3)})`;
                ctx.fillRect(x - w / 2, y - h, w, Math.max(1, h * .1));
                ctx.strokeStyle = `rgba(255,236,150,${(a * .8).toFixed(3)})`;
                ctx.strokeRect(x - w / 2 + .5, y - h + .5, w - 1, h - 1);
            }

            // Partículas
            const mx = mouse.x * W, my = mouse.y * H;
            for (const p of parts) {
                p.y -= p.s * dt * .05;
                p.x += Math.sin(t * .0006 + p.ph) * .18;
                if (p.y < -12) { p.y = H + 12; p.x = rnd(0, W); }
                const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
                if (d2 < 14000) {
                    const d = Math.sqrt(d2) || 1, f = (1 - d / 118) * 1.5;
                    p.x += dx / d * f; p.y += dy / d * f;
                }
                const tw = .55 + .45 * Math.sin(t * .003 + p.ph);
                ctx.globalAlpha = tw * (p.c > .86 ? .95 : .7);
                const s = p.r * (p.c > .86 ? 9 : 12);
                ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;

            // Red de conexiones entre partículas cercanas (solo pantallas amplias)
            if (finePointer && W >= 900) {
                ctx.lineWidth = .8;
                for (let i = 0; i < parts.length; i++) {
                    for (let j = i + 1; j < parts.length; j++) {
                        const a = parts[i], b = parts[j];
                        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                        if (d2 < 11000) {
                            ctx.strokeStyle = `rgba(255,201,24,${((1 - d2 / 11000) * .16).toFixed(3)})`;
                            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                        }
                    }
                }
            }
        }

        function frame(now) {
            raf = requestAnimationFrame(frame);
            if (!visible || document.hidden) { last = now; return; }
            const dt = Math.min(now - last, 50);
            last = now;
            draw(dt);
        }
        function start() { if (!raf && !reduceMotion) { last = performance.now(); raf = requestAnimationFrame(frame); } }
        function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

        if ('ResizeObserver' in window) new ResizeObserver(() => resize()).observe(hero); else window.addEventListener('resize', resize);
        resize();
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }, { threshold: 0 }).observe(hero);
        }
        start();

        state.heroFX = { point: (nx, ny) => { mouse.tx = clamp(nx, 0, 1); mouse.ty = clamp(ny, 0, 1); } };
    }

    /* ======================================================================
       06. REVEALS POR SCROLL (clases CSS + IntersectionObserver)
       ====================================================================== */
    /* Divide el texto de un elemento en palabras con máscara; respeta <em class="grad"> */
    function splitWords(el) {
        const words = [];
        const walk = (node, grad, dark) => {
            Array.from(node.childNodes).forEach(child => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w';
                        const i = document.createElement('span');
                        i.className = 'w__in' + (grad ? (dark ? ' grad-w grad-w--dark' : ' grad-w') : '');
                        i.textContent = part;
                        w.appendChild(i); frag.appendChild(w);
                        words.push(i);
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    const isGrad = child.classList.contains('grad');
                    const isDark = child.classList.contains('grad--dark');
                    if (isGrad) child.classList.remove('grad', 'grad--dark');
                    walk(child, grad || isGrad, dark || isDark);
                }
            });
        };
        walk(el, false, false);
        return words;
    }

    function initReveals() {
        if (!('IntersectionObserver' in window)) return;

        const io = new IntersectionObserver(entries => {
            const batch = entries.filter(e => e.isIntersecting);
            batch.forEach((en, i) => {
                const el = en.target;
                io.unobserve(el);
                if (el.classList.contains('rv') && !el.style.getPropertyValue('--d')) el.style.setProperty('--d', (i * .09).toFixed(2) + 's');
                el.classList.add('is-in');
                if (el.classList.contains('rv')) {
                    // Al terminar, se retira para restaurar las transiciones propias (hover) del elemento
                    const delay = parseFloat(el.style.getPropertyValue('--d')) || 0;
                    setTimeout(() => { el.classList.remove('rv', 'is-in'); el.style.removeProperty('--d'); }, (delay + 1.4) * 1000);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: .1 });

        // Titulares con revelado por palabra
        $$('[data-split]').forEach(h => {
            h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
            const words = splitWords(h);
            words.forEach((w, i) => w.style.setProperty('--i', i));
            h.classList.add('split');
            io.observe(h);
        });
        // Elementos sueltos
        $$('[data-reveal]').forEach(el => { el.classList.add('rv'); io.observe(el); });
        // Grupos con escalonado
        $$('[data-reveal-group]').forEach(g => {
            Array.from(g.children).forEach(c => { c.classList.add('rv'); io.observe(c); });
        });
    }

    /* ======================================================================
       07. EFECTOS GSAP
       ====================================================================== */
    /* Texto del manifiesto: las palabras se "encienden" con el scroll */
    function initScrubText() {
        if (!hasGSAP || reduceMotion) return;
        $$('[data-scrub]').forEach(el => {
            const text = el.textContent.replace(/\s+/g, ' ').trim();
            el.setAttribute('aria-label', text);
            el.innerHTML = text.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
            const words = $$('.word', el);
            gsap.set(words, { opacity: .14 });
            gsap.to(words, {
                opacity: 1, ease: 'none', stagger: .08,
                scrollTrigger: { trigger: el, start: 'top 84%', end: 'bottom 50%', scrub: .6 }
            });
        });
    }

    /* Catálogo: carrusel horizontal anclado (escritorio) o scroll-snap (móvil) */
    function initCatalog() {
        const section = $('#productos');
        const track = $('#catalog-track');
        if (!section || !track) return;
        const sticky = $('.catalog__sticky', section);
        const now = $('#cat-now');
        const bar = $('#cat-bar');
        const cards = $$('.pcard', track);
        const real = cards.filter(c => !c.classList.contains('pcard--end'));

        const meter = p => {
            p = clamp(p, 0, 1);
            if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
            if (now) now.textContent = pad(Math.min(real.length, Math.round(p * (real.length - 1)) + 1));
        };

        // Modo nativo: actualizar medidor con el scroll horizontal
        track.addEventListener('scroll', () => {
            const max = track.scrollWidth - track.clientWidth;
            if (max > 0 && !section.classList.contains('is-hscroll')) meter(track.scrollLeft / max);
        }, { passive: true });

        if (!hasGSAP) return;
        const mm = gsap.matchMedia();
        mm.add('(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
            section.classList.add('is-hscroll');
            track.removeAttribute('tabindex');

            const dist = () => {
                const cs = getComputedStyle(track);
                const gap = parseFloat(cs.columnGap) || 0;
                const total = cards.reduce((sum, c) => sum + c.offsetWidth, 0) + gap * (cards.length - 1)
                    + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
                return Math.max(0, total - window.innerWidth);
            };
            // La altura de la sección debe actualizarse ANTES de que ScrollTrigger mida
            const setDist = () => section.style.setProperty('--hdist', Math.round(dist()) + 'px');
            setDist();
            ScrollTrigger.addEventListener('refreshInit', setDist);

            // El panel se queda fijo con position:sticky; ScrollTrigger solo traduce el carril
            const tween = gsap.to(track, {
                x: () => -dist(),
                ease: 'none',
                scrollTrigger: {
                    trigger: section,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: .7,
                    invalidateOnRefresh: true,
                    onUpdate: self => meter(self.progress)
                }
            });
            // Parallax horizontal de cada imagen (usa la propiedad `translate`, sin chocar con el hover)
            cards.forEach(card => {
                ScrollTrigger.create({
                    trigger: card, containerAnimation: tween,
                    start: 'left right', end: 'right left',
                    onUpdate: self => card.style.setProperty('--px', ((self.progress - .5) * -9).toFixed(2) + '%')
                });
            });
            meter(0);
            return () => {
                ScrollTrigger.removeEventListener('refreshInit', setDist);
                section.classList.remove('is-hscroll');
                section.style.removeProperty('--hdist');
                track.setAttribute('tabindex', '0');
                cards.forEach(c => c.style.removeProperty('--px'));
            };
        });
    }

    /* Proceso: línea que se dibuja, montacargas que avanza y pasos que se activan */
    function initProcess() {
        const wrap = $('#steps');
        if (!wrap || !hasGSAP) return;
        const fill = $('#steps-fill');
        const truck = $('#steps-truck');
        const steps = $$('.step', wrap);

        ScrollTrigger.create({
            trigger: wrap, start: 'top 65%', end: 'bottom 55%', scrub: true,
            onUpdate: self => {
                fill.style.transform = `scaleY(${self.progress.toFixed(4)})`;
                truck.style.top = (self.progress * 100).toFixed(2) + '%';
            }
        });
        steps.forEach(step => ScrollTrigger.create({
            trigger: step, start: 'top 62%', end: 'bottom 38%',
            onToggle: self => step.classList.toggle('is-active', self.isActive)
        }));
        if (reduceMotion) steps.forEach(s => s.classList.add('is-active'));
    }

    /* Contadores */
    function initCounters() {
        if (!hasGSAP) return;
        $$('[data-count]').forEach(el => {
            const target = parseFloat(el.dataset.count);
            const o = { v: 0 };
            el.textContent = '0';
            ScrollTrigger.create({
                trigger: el, start: 'top 92%', once: true,
                onEnter: () => gsap.to(o, {
                    v: target, duration: reduceMotion ? .01 : 2.2, ease: 'power2.out',
                    onUpdate: () => { el.textContent = Math.round(o.v); },
                    onComplete: () => { el.textContent = target; }
                })
            });
        });
    }

    /* Parallax suave y wordmark del footer */
    function initParallax() {
        if (!hasGSAP || reduceMotion) return;
        const media = $('.showcase__media');
        if (media) {
            gsap.fromTo(media, { yPercent: 5 }, {
                yPercent: -5, ease: 'none',
                scrollTrigger: { trigger: '.showcase', start: 'top bottom', end: 'bottom top', scrub: true }
            });
        }
        const giant = $('.footer__giant');
        if (giant) {
            gsap.fromTo(giant, { yPercent: 35, opacity: .15 }, {
                yPercent: 0, opacity: 1, ease: 'none',
                scrollTrigger: { trigger: '.footer', start: 'top 95%', end: 'bottom bottom', scrub: true }
            });
        }
    }

    /* ======================================================================
       08. MARQUEES (WAAPI) · la velocidad reacciona al scroll
       ====================================================================== */
    function initMarquees() {
        const nodes = $$('[data-marquee]');
        if (!nodes.length) return;

        if (reduceMotion || !Element.prototype.animate) {
            nodes.forEach(n => n.classList.add('is-static'));
            return;
        }

        const items = [];

        function build(m) {
            const dir = parseInt(m.node.dataset.marquee, 10) || -1;
            const track = m.track;
            if (m.anim) { m.anim.cancel(); m.anim = null; }
            // Limpia clones previos
            $$('[data-clone]', track).forEach(c => c.remove());

            const base = Array.from(track.children);
            const setW = track.getBoundingClientRect().width || track.scrollWidth;
            if (!setW) return;
            const container = m.node.classList.contains('gal__row') ? m.node : m.node.parentElement;
            const viewW = container.getBoundingClientRect().width || window.innerWidth;
            const copies = Math.ceil(viewW / setW) + 1;
            for (let c = 0; c < copies; c++) {
                base.forEach(n => {
                    const clone = n.cloneNode(true);
                    clone.setAttribute('aria-hidden', 'true');
                    clone.setAttribute('data-clone', '');
                    clone.querySelectorAll('button, a').forEach(x => { x.tabIndex = -1; });
                    track.appendChild(clone);
                });
            }
            const from = dir < 0 ? 0 : -setW;
            const to = dir < 0 ? -setW : 0;
            m.anim = track.animate(
                [{ transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${to}px,0,0)` }],
                { duration: (setW / m.pps) * 1000, iterations: Infinity, easing: 'linear' }
            );
            m.node.classList.add('is-marquee');
        }

        nodes.forEach(node => {
            const track = node.classList.contains('gal__row') ? node.firstElementChild : node;
            const pps = node.classList.contains('gal__row') ? 55 : (node.closest('.ribbon__band--back') ? 42 : 78);
            const m = { node, track, pps, anim: null, hover: false, visible: true };
            if (node.classList.contains('gal__row')) {
                node.addEventListener('pointerenter', () => { m.hover = true; });
                node.addEventListener('pointerleave', () => { m.hover = false; });
            }
            if ('IntersectionObserver' in window) {
                new IntersectionObserver(([e]) => { m.visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(node);
            }
            items.push(m);
            build(m);
        });

        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => items.forEach(build), 250); });

        // Un solo bucle ajusta la velocidad de todas las cintas
        let boost = 0;
        (function loop() {
            boost = lerp(boost, clamp(Math.abs(bus.v) * .09, 0, 6), .08);
            items.forEach(m => {
                if (!m.anim) return;
                if (!m.visible || document.hidden) { if (m.anim.playState === 'running') m.anim.pause(); return; }
                if (m.anim.playState === 'paused') m.anim.play();
                const target = m.hover ? 0 : 1 + boost;
                m.anim.playbackRate = lerp(m.anim.playbackRate, target, .08);
            });
            requestAnimationFrame(loop);
        })();
    }

    /* ======================================================================
       09. INDUSTRIAS · FAQ · COMPARATIVA
       ====================================================================== */
    function initSectors() {
        const list = $$('#sectors .sector');
        const a = $('#preview-a');
        const b = $('#preview-b');
        if (!list.length || !a || !b) return;
        let front = a, back = b, current = list[0];

        function activate(li) {
            if (li === current) return;
            current = li;
            list.forEach(x => {
                const on = x === li;
                x.classList.toggle('is-active', on);
                $('.sector__btn', x).setAttribute('aria-expanded', String(on));
            });
            const src = li.dataset.img;
            if (!src) return;
            back.alt = li.dataset.alt || '';
            const swap = () => {
                back.classList.add('is-front');
                front.classList.remove('is-front');
                [front, back] = [back, front];
            };
            back.src = src;
            if (back.decode) back.decode().then(swap).catch(swap); else swap();
        }

        list.forEach(li => {
            const btn = $('.sector__btn', li);
            li.addEventListener('mouseenter', () => { if (finePointer) activate(li); });
            btn.addEventListener('click', () => activate(li));
            btn.addEventListener('focus', () => activate(li));
        });
    }

    function initFAQ() {
        const items = $$('#faq-list .qa');
        const set = (qa, open) => {
            qa.classList.toggle('is-open', open);
            $('.qa__q button', qa).setAttribute('aria-expanded', String(open));
        };
        items.forEach(qa => {
            $('.qa__q button', qa).addEventListener('click', () => {
                const open = !qa.classList.contains('is-open');
                items.forEach(o => { if (o !== qa) set(o, false); });
                set(qa, open);
                if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 700);
            });
        });
    }

    function initSwitch() {
        const box = $('.switch');
        if (!box) return;
        const tabs = $$('.switch__tab', box);
        const panels = $$('.switch__panel', box);
        const select = i => {
            tabs.forEach((t, k) => {
                t.classList.toggle('is-active', k === i);
                t.setAttribute('aria-selected', String(k === i));
                t.tabIndex = k === i ? 0 : -1;
            });
            panels.forEach((p, k) => { p.hidden = k !== i; p.classList.toggle('is-active', k === i); });
            box.dataset.state = i === 0 ? 'new' : 'used';
        };
        tabs.forEach((t, i) => {
            t.addEventListener('click', () => select(i));
            t.addEventListener('keydown', e => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                    select(n); tabs[n].focus();
                }
            });
        });
        box.dataset.state = 'new';
    }

    /* ======================================================================
       10. GALERÍA + LIGHTBOX · VIDEO
       ====================================================================== */
    function initLightbox() {
        const dlg = $('#lightbox');
        const gallery = $('#gallery');
        if (!dlg || !gallery) return;
        const img = $('#lb-img');
        const cap = $('#lb-cap');
        const items = $$('.gal__item', gallery);
        items.forEach((b, i) => { b.dataset.i = i; b.dataset.cursor = 'Ver'; });
        let idx = 0;

        function show(i) {
            idx = (i + items.length) % items.length;
            const src = $('img', items[idx]);
            img.classList.remove('is-in');
            img.src = src.currentSrc || src.src;
            img.alt = src.alt;
            cap.textContent = items[idx].dataset.cap || src.alt;
            if (img.complete) img.classList.add('is-in');
        }
        img.addEventListener('load', () => img.classList.add('is-in'));

        gallery.addEventListener('click', e => {
            const b = e.target.closest('.gal__item');
            if (!b) return;
            show(+b.dataset.i);
            if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
            lockScroll('lightbox');
        });
        dlg.addEventListener('close', () => unlockScroll('lightbox'));
        $('#lb-close').addEventListener('click', () => dlg.close());
        $('#lb-prev').addEventListener('click', () => show(idx - 1));
        $('#lb-next').addEventListener('click', () => show(idx + 1));
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight') show(idx + 1);
            if (e.key === 'ArrowLeft') show(idx - 1);
        });
        // Swipe táctil
        let sx = 0;
        dlg.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; }, { passive: true });
        dlg.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
        }, { passive: true });

        $('#lb-cta').addEventListener('click', () => {
            const msg = $('#f-msg');
            if (msg && !msg.value.trim()) {
                msg.value = 'Me interesa el equipo de la imagen: ' + (items[idx].dataset.cap || '');
                msg.dispatchEvent(new Event('input', { bubbles: true }));
            }
            dlg.close();
        });
    }

    function initVideo() {
        const v = $('#promo-video');
        const playBtn = $('#player-play');
        const soundBtn = $('#player-sound');
        if (!v || !playBtn) return;
        let userPaused = false;

        const icon = () => { playBtn.firstElementChild.className = v.paused ? 'ph-fill ph-play' : 'ph-fill ph-pause'; };
        v.addEventListener('play', icon);
        v.addEventListener('pause', icon);

        playBtn.addEventListener('click', () => {
            if (v.paused) { userPaused = false; v.play().catch(() => {}); }
            else { userPaused = true; v.pause(); }
        });
        soundBtn.addEventListener('click', () => {
            v.muted = !v.muted;
            soundBtn.firstElementChild.className = v.muted ? 'ph-bold ph-speaker-slash' : 'ph-bold ph-speaker-high';
            if (!v.muted && v.paused) { userPaused = false; v.play().catch(() => {}); }
        });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(([e]) => {
                if (e.isIntersecting && !userPaused && !reduceMotion) v.play().catch(() => {});
                else if (!e.isIntersecting) v.pause();
            }, { threshold: .45 }).observe(v);
        }
    }

    /* ======================================================================
       11. FORMULARIO → WHATSAPP
       ====================================================================== */
    function initQuoteLinks() {
        const select = $('#f-product');
        const form = $('#quote-form');
        document.addEventListener('click', e => {
            const a = e.target.closest('[data-quote]');
            if (a && select) {
                const val = a.dataset.quote;
                const opt = Array.from(select.options).find(o => o.value === val || o.text === val);
                if (opt) { select.value = opt.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
                flash();
            }
            const c = e.target.closest('[data-quote-condition]');
            if (c) {
                const state = $('.switch') ? $('.switch').dataset.state : 'new';
                const radio = $(`input[name="condition"][value="${state === 'used' ? 'Seminuevo' : 'Nuevo'}"]`);
                if (radio) radio.checked = true;
                flash();
            }
        });
        function flash() {
            if (!form) return;
            form.classList.remove('is-flash'); void form.offsetWidth; form.classList.add('is-flash');
        }
    }

    function initForm() {
        const form = $('#quote-form');
        if (!form) return;
        const ok = $('#form-ok');
        const okLink = $('#form-ok-link');
        const fields = {
            name: { el: $('#f-name'), err: $('#e-name') },
            phone: { el: $('#f-phone'), err: $('#e-phone') },
            product: { el: $('#f-product'), err: $('#e-product') }
        };

        const setErr = (f, msg) => {
            f.err.textContent = msg || '';
            f.el.closest('.field').classList.toggle('has-error', !!msg);
            if (msg) f.el.setAttribute('aria-invalid', 'true'); else f.el.removeAttribute('aria-invalid');
            return !msg;
        };
        function validate() {
            let good = true;
            good = setErr(fields.name, fields.name.el.value.trim().length < 2 ? 'Escribe tu nombre para poder atenderte.' : '') && good;
            good = setErr(fields.product, !fields.product.el.value ? 'Selecciona el equipo que necesitas.' : '') && good;
            const digits = fields.phone.el.value.replace(/\D/g, '');
            good = setErr(fields.phone, fields.phone.el.value && digits.length < 8 ? 'Revisa tu teléfono (mínimo 8 dígitos).' : '') && good;
            return good;
        }
        Object.values(fields).forEach(f => {
            f.el.addEventListener('input', () => { if (f.el.closest('.field').classList.contains('has-error')) validate(); });
            f.el.addEventListener('change', () => { if (f.el.closest('.field').classList.contains('has-error')) validate(); });
        });

        form.addEventListener('submit', e => {
            e.preventDefault();
            if (!validate()) {
                const first = form.querySelector('.has-error input, .has-error select');
                if (first) first.focus();
                return;
            }
            const d = Object.fromEntries(new FormData(form));
            const lines = [
                `Hola Montrack, soy ${d.name.trim()}${d.company && d.company.trim() ? ' de ' + d.company.trim() : ''}.`,
                `Me interesa cotizar: ${d.product} (${d.condition}).`
            ];
            if (d.message && d.message.trim()) lines.push(`Detalles: ${d.message.trim()}`);
            if (d.phone && d.phone.trim()) lines.push(`Mi teléfono: ${d.phone.trim()}`);
            lines.push('Enviado desde montrackmexico.com');
            const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;

            form.classList.add('is-sending');
            okLink.href = url;
            ok.hidden = false;
            window.open(url, '_blank', 'noopener');
            setTimeout(() => form.classList.remove('is-sending'), 1200);
        });
    }

    /* ======================================================================
       12. CURSOR · MAGNETISMO · TILT · WHATSAPP FLOTANTE
       ====================================================================== */
    function initCursor() {
        const cur = $('#cursor');
        if (!cur || !finePointer || reduceMotion) return;
        root.classList.add('has-cursor');
        const dot = $('.cursor__dot', cur);
        const ring = $('.cursor__ring', cur);
        const label = $('.cursor__label', cur);
        let x = -100, y = -100, rx = x, ry = y;

        window.addEventListener('pointermove', e => {
            x = e.clientX; y = e.clientY;
            cur.classList.remove('is-hidden');
            const t = e.target;
            const lab = t.closest && t.closest('[data-cursor]');
            const hov = t.closest && t.closest('a, button, label, select, input, textarea, summary');
            cur.classList.toggle('is-label', !!lab);
            if (lab) label.textContent = lab.dataset.cursor;
            cur.classList.toggle('is-hover', !!hov && !lab);
        }, { passive: true });
        document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));

        (function loop() {
            rx = lerp(rx, x, .18); ry = lerp(ry, y, .18);
            dot.style.transform = `translate3d(${x}px,${y}px,0)`;
            ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
            requestAnimationFrame(loop);
        })();
    }

    function initMagnetic() {
        if (!finePointer || reduceMotion) return;
        $$('[data-magnetic]').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const dx = (e.clientX - (r.left + r.width / 2)) * .22;
                const dy = (e.clientY - (r.top + r.height / 2)) * .3;
                el.style.setProperty('--tx', dx.toFixed(1) + 'px');
                el.style.setProperty('--ty', dy.toFixed(1) + 'px');
            });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
        });
    }

    function initTilt() {
        if (!finePointer || reduceMotion) return;
        $$('[data-tilt]').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - .5;
                const py = (e.clientY - r.top) / r.height - .5;
                el.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg');
                el.style.setProperty('--rx', (-py * 7).toFixed(2) + 'deg');
            });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
        });
    }

    function initWhatsAppBubble() {
        const bubble = $('#wa-bubble');
        if (!bubble) return;
        const run = () => {
            setTimeout(() => {
                bubble.classList.add('is-show');
                setTimeout(() => bubble.classList.remove('is-show'), 6500);
            }, 7000);
        };
        if (state.ready) run(); else document.addEventListener('montrack:ready', run, { once: true });
    }

    /* ======================================================================
       ARRANQUE
       ====================================================================== */
    function boot() {
        const y = $('#year');
        if (y) y.textContent = new Date().getFullYear();

        // Módulos que no dependen del preloader
        initScroll();
        initAnchors();
        initHeader();
        initMenu();
        initSpy();
        initHeroIntro();
        initReveals();
        initScrubText();
        initCatalog();
        initProcess();
        initCounters();
        initParallax();
        initLightbox();   // antes de los marquees: numera los originales
        initMarquees();
        initSectors();
        initFAQ();
        initSwitch();
        initVideo();
        initQuoteLinks();
        initForm();
        initCursor();
        initMagnetic();
        initTilt();
        initHeroCanvas();
        initHeroPointer();
        initRotator();
        initStage();
        initWhatsAppBubble();

        initPreloader().then(() => {
            document.dispatchEvent(new Event('montrack:ready'));
            // Recalcula posiciones de ScrollTrigger cuando todo terminó de cargar
            if (hasGSAP) {
                ScrollTrigger.refresh();
                setTimeout(() => ScrollTrigger.refresh(), 1200);
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
