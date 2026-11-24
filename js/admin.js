/* ============================================================
   AMBER FIELDS — СКРЫТАЯ АДМИН-ПАНЕЛЬ (только для тестов)
   Авто-вход: если рядом с index.html лежит admins.js и в нём
   верные данные — панель включается при загрузке страницы.
   Без файла: URL с #admin открывает форму входа (логин + пароль + дата).
   Публичное API: Admin.open(), Admin.close(), Admin.init()
   ============================================================ */

const Admin = (function () {
    'use strict';

    // ---- ДОСТУП ----------------------------------------------
    // Файл admins.js в корне проекта задаёт window.AMBER_ADMINS.
    // Формат строго такой (любое отличие = отказ):
    // login:Sedonit password:081446 date:04.02 admins:local_user_liz_sed
    const ADMINS_GLOBAL = 'AMBER_ADMINS';

    // Эталон. Сверяется и файл, и ручной ввод — посимвольно.
    const EXPECTED = {
        login: 'Sedonit',
        password: '081446',
        date: '04.02',
        admins: 'local_user_liz_sed'
    };
    const EXPECTED_LINE = 'login:' + EXPECTED.login +
        ' password:' + EXPECTED.password +
        ' date:' + EXPECTED.date +
        ' admins:' + EXPECTED.admins;

    let autoUnlockAttempted = false;

    // ---- КЛЮЧИ localStorage ----------------------------------
    const LOCK_KEY = 'admin_lock_until';   // timestamp блокировки
    const FAIL_KEY = 'admin_fails';        // счётчик неверных попыток
    const DEBUG_KEY = 'admin_DEBUG_ERROR'; // флаг симуляции ошибки
    const MAINT_KEY = 'admin_MAINTENANCE'; // флаг техработ
    const VERBOSE_KEY = 'admin_verbose';   // подробные логи админки

    // ---- КОНСТАНТЫ -------------------------------------------
    const LOCK_MS = 30000;  // блокировка после 3 ошибок
    const MAX_FAILS = 3;

    // ---- СОСТОЯНИЕ -------------------------------------------
    let root = null;
    let gate = null;
    let stage = null;
    let unlocked = false;   // разблокировано до перезагрузки страницы
    let isOpen = false;
    let lockTicker = null;
    let closeTimer = null;
    let feedbackTimer = null;
    let confirmVisible = false;
    let verbose = false;
    let lastFullDump = '';
    let initialized = false;
    let fab = null;         // плавающая кнопка (только после входа)

    // ---- ХРАНИЛИЩЕ (без падений в приватном режиме) ----------
    const store = {
        get(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        }
    };

    // ---- ДОСТУП К ИГРОВЫМ МОДУЛЯМ ----------------------------
    // Модули объявлены через const, поэтому обращаемся по имени с проверкой
    function loaderMod() { return typeof Loader !== 'undefined' ? Loader : null; }
    function screenMod() { return typeof ScreenManager !== 'undefined' ? ScreenManager : null; }
    function modalMod() { return typeof Modal !== 'undefined' ? Modal : null; }
    function introMod() { return typeof Intro !== 'undefined' ? Intro : null; }
    function menuMod() { return typeof MainMenu !== 'undefined' ? MainMenu : null; }
    function progressMod() { return typeof Progress !== 'undefined' ? Progress : null; }

    function log() {
        if (!verbose) return;
        try { console.log.apply(console, ['[Admin]'].concat([].slice.call(arguments))); } catch (e) { /* ignore */ }
    }

    function warn() {
        try { console.warn.apply(console, ['[Admin]'].concat([].slice.call(arguments))); } catch (e) { /* ignore */ }
    }

    // ---- ЧТЕНИЕ admins.js ------------------------------------
    // Приводим только пробелы/переносы строк, содержимое не прощаем:
    // любая изменённая буква или цифра даёт несовпадение.
    function normalizeAdmins(text) {
        return String(text)
            .replace(/^\uFEFF/, '')                    // BOM из Блокнота
            .replace(/[\u200B-\u200D\uFEFF]/g, '')      // невидимые символы
            .replace(/\u00A0/g, ' ')                    // неразрывный пробел
            .replace(/\r\n?/g, '\n')
            .trim()
            .replace(/[ \t]+/g, ' ');
    }

    function isValidAdminsFile(text) {
        return normalizeAdmins(text) === EXPECTED_LINE;
    }

    function grantAccess(source) {
        unlocked = true;
        store.set(FAIL_KEY, '0');
        store.remove(LOCK_KEY);
        log('доступ выдан:', source);

        if (isOpen) {
            if (root) showStage();
        } else {
            syncFab();
        }
    }

    // Авто-вход: admins.js подключён к index.html и задаёт window.AMBER_ADMINS
    function tryLocalUnlock() {
        if (autoUnlockAttempted) return;
        autoUnlockAttempted = true;

        let data;
        try {
            data = window[ADMINS_GLOBAL];
        } catch (e) {
            data = undefined;
        }

        if (typeof data === 'undefined' || data === null) {
            log('admins.js не подключён — авто-вход выключен');
            return;
        }

        if (!isValidAdminsFile(data)) {
            warn('admins.js не совпадает с эталоном — доступа нет. Получено: "' + normalizeAdmins(data) + '"');
            return;
        }

        grantAccess('admins.js');
    }

    function showToast(text) {
        const modal = modalMod();
        if (modal && typeof modal.showToast === 'function') modal.showToast(text);
    }

    // ---- РАЗМЕТКА (создаётся через JS) -----------------------
    function buildRoot() {
        root = document.createElement('div');
        root.id = 'admin-root';

        root.innerHTML = [
            '<div class="admin-overlay admin-gate" aria-hidden="true">',
            '  <div class="admin-panel admin-panel--lock" role="dialog" aria-modal="true" aria-labelledby="admin-gate-title">',
            '    <div class="admin-head">',
            '      <span class="admin-kicker">AMBER FIELDS · DEBUG</span>',
            '      <button type="button" class="admin-icon" data-action="close" aria-label="Закрыть">✕</button>',
            '    </div>',
            '    <h2 class="admin-title" id="admin-gate-title">АДМИН-ПАНЕЛЬ</h2>',
            '    <p class="admin-hint">Только для разработчика.<br>Логин, пароль и дата</p>',
            '    <form class="admin-gate-form" autocomplete="off">',
            '      <input class="admin-input" name="admin-login" type="text" maxlength="32" placeholder="ЛОГИН" aria-label="Логин" autocomplete="off" spellcheck="false">',
            '      <input class="admin-input" name="admin-pass" type="password" maxlength="32" placeholder="ПАРОЛЬ" aria-label="Пароль" autocomplete="off">',
            '      <input class="admin-input" name="admin-date" type="text" inputmode="numeric" maxlength="5" placeholder="ДАТА" aria-label="Дата" autocomplete="off">',
            '      <p class="admin-error" role="alert"></p>',
            '      <div class="admin-row">',
            '        <button type="button" class="admin-btn" data-action="close">ОТМЕНА</button>',
            '        <button type="submit" class="admin-btn admin-btn--gold">ВОЙТИ</button>',
            '      </div>',
            '    </form>',
            '    <p class="admin-lock-note admin-hidden"></p>',
            '  </div>',
            '</div>',

            '<div class="admin-overlay admin-stage" aria-hidden="true">',
            '  <div class="admin-panel" role="dialog" aria-modal="true" aria-label="Админ-панель">',

            '    <div class="admin-head">',
            '      <span class="admin-kicker">AMBER FIELDS · DEBUG</span>',
            '      <button type="button" class="admin-icon" data-action="reload" title="Перезагрузить страницу" aria-label="Перезагрузить страницу">⟳</button>',
            '      <button type="button" class="admin-icon" data-action="close" aria-label="Закрыть">✕</button>',
            '    </div>',

            '    <div class="admin-body">',

            '      <div class="admin-section">',
            '        <h3 class="admin-section-title">1 · Быстрый переход</h3>',
            '        <div class="admin-grid">',
            '          <button type="button" class="admin-btn" data-action="jump" data-target="loader">LOADER</button>',
            '          <button type="button" class="admin-btn" data-action="jump" data-target="menu">MAIN MENU</button>',
            '          <button type="button" class="admin-btn" data-action="jump" data-target="intro">INTRO</button>',
            '          <button type="button" class="admin-btn" data-action="jump" data-target="game">GAME</button>',
            '          <button type="button" class="admin-btn" data-action="jump" data-target="credits">CREDITS</button>',
            '          <button type="button" class="admin-btn" data-action="jump" data-target="help">HELP</button>',
            '          <button type="button" class="admin-btn admin-btn--wide" data-action="jump" data-target="maintenance">MAINTENANCE</button>',
            '        </div>',
            '      </div>',

            '      <div class="admin-section">',
            '        <h3 class="admin-section-title">2 · Флаги тестирования</h3>',
            '        <button type="button" class="admin-toggle" data-action="toggle-debug" aria-pressed="false">',
            '          <span class="admin-toggle-label">СИМУЛЯЦИЯ ОШИБКИ</span>',
            '          <span class="admin-toggle-state" data-state>ВЫКЛ</span>',
            '        </button>',
            '        <button type="button" class="admin-toggle" data-action="toggle-maint" aria-pressed="false">',
            '          <span class="admin-toggle-label">РЕЖИМ ТЕХРАБОТ</span>',
            '          <span class="admin-toggle-state" data-state>ВЫКЛ</span>',
            '        </button>',
            '        <p class="admin-note">Сохраняются сразу, применяются после перезагрузки (⟳ вверху).</p>',
            '      </div>',

            '      <div class="admin-section">',
            '        <h3 class="admin-section-title">3 · Действия</h3>',
            '        <div class="admin-grid">',
            '          <button type="button" class="admin-btn" data-action="skip-loading">ПРОПУСТИТЬ ЗАГРУЗКУ</button>',
            '          <button type="button" class="admin-btn" data-action="skip-intro">ПРОПУСТИТЬ ИНТРО</button>',
            '          <button type="button" class="admin-btn" data-action="reset-progress">СБРОСИТЬ ПРОГРЕСС</button>',
            '          <button type="button" class="admin-btn admin-btn--danger" data-action="wipe">ПОЛНЫЙ WIPE</button>',
            '        </div>',
            '      </div>',

            '      <div class="admin-section">',
            '        <h3 class="admin-section-title">4 · Информация</h3>',
            '        <div class="admin-screen-line"><span>АКТИВНЫЙ ЭКРАН</span><strong data-info-screen>—</strong></div>',
            '        <pre class="admin-info" data-info-json>—</pre>',
            '        <p class="admin-meta" data-info-meta></p>',
            '        <div class="admin-row">',
            '          <button type="button" class="admin-btn" data-action="refresh">ОБНОВИТЬ</button>',
            '          <button type="button" class="admin-btn" data-action="copy">КОПИРОВАТЬ</button>',
            '        </div>',
            '      </div>',

            '      <div class="admin-section">',
            '        <h3 class="admin-section-title">5 · Логи</h3>',
            '        <div class="admin-row">',
            '          <button type="button" class="admin-btn" data-action="console-hint">ОТКРЫТЬ КОНСОЛЬ</button>',
            '        </div>',
            '        <button type="button" class="admin-toggle" data-action="toggle-verbose" aria-pressed="false">',
            '          <span class="admin-toggle-label">VERBOSE LOGS</span>',
            '          <span class="admin-toggle-state" data-state>ВЫКЛ</span>',
            '        </button>',
            '        <p class="admin-note">Пока логирует только админку. TODO: подключить модули игры.</p>',
            '      </div>',

            '    </div>',

            '    <div class="admin-feedback" role="status" aria-live="polite"></div>',

            '    <div class="admin-confirm admin-hidden">',
            '      <p>ПОЛНЫЙ WIPE УДАЛИТ<br>ПРОГРЕСС, НАСТРОЙКИ И ФЛАГИ.<br>ЭТО НЕОБРАТИМО.</p>',
            '      <div class="admin-row">',
            '        <button type="button" class="admin-btn" data-action="wipe-cancel">ОТМЕНА</button>',
            '        <button type="button" class="admin-btn admin-btn--danger" data-action="wipe-confirm">СТЕРЕТЬ ВСЁ</button>',
            '      </div>',
            '    </div>',

            '  </div>',
            '</div>'
        ].join('\n');

        document.body.appendChild(root);

        gate = root.querySelector('.admin-gate');
        stage = root.querySelector('.admin-stage');

        // Дата: только цифры и одна точка (04.02)
        const dateInput = gate.querySelector('input[name="admin-date"]');
        if (dateInput) {
            dateInput.addEventListener('input', function () {
                this.value = this.value.replace(/[^\d.]/g, '').slice(0, 5);
            });
        }

        // Отправка пароля
        gate.querySelector('form').addEventListener('submit', function (e) {
            e.preventDefault();
            submitPassword();
        });

        // Делегирование кнопок
        root.addEventListener('click', onRootClick);

        // Клик по затемнению закрывает
        [gate, stage].forEach(function (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) close();
            });
        });

        log('UI построен');
    }

    // ---- ОБРАБОТКА КЛИКОВ ------------------------------------
    function onRootClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        switch (action) {
            case 'close':
                close();
                break;
            case 'reload':
                window.location.reload();
                break;
            case 'jump':
                jumpTo(btn.dataset.target);
                break;
            case 'toggle-debug':
                toggleDebug();
                break;
            case 'toggle-maint':
                toggleMaintenance();
                break;
            case 'toggle-verbose':
                toggleVerbose();
                break;
            case 'skip-loading':
                skipLoading();
                break;
            case 'skip-intro':
                skipIntro();
                break;
            case 'reset-progress':
                resetProgress();
                break;
            case 'wipe':
                setConfirm(true);
                break;
            case 'wipe-cancel':
                setConfirm(false);
                break;
            case 'wipe-confirm':
                doWipe();
                break;
            case 'refresh':
                syncInfo();
                flash('ДАННЫЕ ОБНОВЛЕНЫ');
                break;
            case 'copy':
                copyStorage();
                break;
            case 'console-hint':
                consoleHint();
                break;
        }
    }

    // ---- ОТКРЫТИЕ / ЗАКРЫТИЕ ---------------------------------
    function open() {
        if (!initialized) init();
        buildRootIfNeeded();

        // Панель уже открыта: не пускаем внутрь без пароля
        if (isOpen) {
            if (unlocked) showStage();
            else showGate();
            return;
        }

        isOpen = true;

        if (unlocked) {
            showStage();
        } else {
            showGate();
        }

        syncFab();
        log('open');
    }

    function close() {
        if (!root) return;

        gate.classList.remove('active');
        gate.setAttribute('aria-hidden', 'true');
        stage.classList.remove('active');
        stage.setAttribute('aria-hidden', 'true');

        isOpen = false;
        setConfirm(false);
        stopLockTicker();
        syncFab();

        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        if (feedbackTimer) {
            clearTimeout(feedbackTimer);
            feedbackTimer = null;
            const fb = stage.querySelector('.admin-feedback');
            if (fb) fb.classList.remove('visible');
        }

        log('close');
    }

    function buildRootIfNeeded() {
        if (!root) buildRoot();
    }

    // ---- ПЛАВАЮЩАЯ КНОПКА ------------------------------------
    // Создаётся исключительно после успешного ввода пароля.
    // Пока админка не активирована — элемента нет в DOM вообще.
    const FAB_ICON = [
        '<svg viewBox="0 0 16 16" width="24" height="24" shape-rendering="crispEdges" aria-hidden="true" focusable="false">',
        '  <rect x="1" y="3" width="14" height="2"/>',
        '  <rect x="6" y="1" width="4" height="6"/>',
        '  <rect x="1" y="11" width="14" height="2"/>',
        '  <rect x="9" y="9" width="4" height="6"/>',
        '</svg>'
    ].join('');

    function syncFab() {
        if (!unlocked) {
            removeFab();
            return;
        }

        if (!fab) {
            fab = document.createElement('button');
            fab.id = 'admin-fab';
            fab.type = 'button';
            fab.className = 'admin-fab';
            fab.title = 'Админ-панель';
            fab.setAttribute('aria-label', 'Открыть админ-панель');
            fab.innerHTML = FAB_ICON;
            fab.addEventListener('click', function () {
                if (!isOpen) open();
            });
            document.body.appendChild(fab);

            requestAnimationFrame(function () {
                if (fab) fab.classList.add('visible');
            });
        }

        // Пока панель открыта, кнопка не мешает
        fab.classList.toggle('admin-fab--hidden', isOpen);
    }

    function removeFab() {
        if (!fab) return;
        const el = fab;
        fab = null;
        el.classList.remove('visible');
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 260);
    }

    function showGate() {
        stage.classList.remove('active');
        stage.setAttribute('aria-hidden', 'true');

        gate.classList.add('active');
        gate.setAttribute('aria-hidden', 'false');

        const input = gate.querySelector('input[name="admin-login"]');
        const err = gate.querySelector('.admin-error');

        if (isLocked()) {
            err.textContent = 'ЗАБЛОКИРОВАНО';
            gate.querySelector('input[name="admin-pass"]').value = '';
            startLockTicker();
        } else {
            err.textContent = '';
            renderLock(0);
            setTimeout(function () {
                if (isOpen && gate.classList.contains('active')) {
                    try { input.focus({ preventScroll: true }); } catch (e2) { input.focus(); }
                }
            }, 60);
        }
    }

    function showStage() {
        gate.classList.remove('active');
        gate.setAttribute('aria-hidden', 'true');

        stage.classList.add('active');
        stage.setAttribute('aria-hidden', 'false');

        syncAll();

        setTimeout(function () {
            if (!isOpen) return;
            const x = stage.querySelector('.admin-x') || stage.querySelector('.admin-icon');
            if (x) {
                try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); }
            }
        }, 260);
    }

    // ---- ПАРОЛЬ ----------------------------------------------
    function getLockUntil() {
        const raw = parseInt(store.get(LOCK_KEY) || '0', 10);
        return isNaN(raw) ? 0 : raw;
    }

    function isLocked() {
        return Date.now() < getLockUntil();
    }

    function submitPassword() {
        if (isLocked()) {
            startLockTicker();
            return;
        }

        const loginInput = gate.querySelector('input[name="admin-login"]');
        const passInput = gate.querySelector('input[name="admin-pass"]');
        const dateInput = gate.querySelector('input[name="admin-date"]');
        const err = gate.querySelector('.admin-error');

        const loginValue = loginInput.value.trim();
        const passValue = passInput.value.trim();
        const dateValue = dateInput.value.trim();

        // Строгое посимвольное совпадение — регистр тоже важен
        const okLogin = loginValue === EXPECTED.login;
        const okPass = passValue === EXPECTED.password;
        const okDate = dateValue === EXPECTED.date;

        if (okLogin && okPass && okDate) {
            loginInput.value = '';
            passInput.value = '';
            dateInput.value = '';
            err.textContent = '';
            stopLockTicker();
            log('данные верные');
            grantAccess('форма входа');
            return;
        }

        const fails = (parseInt(store.get(FAIL_KEY) || '0', 10) || 0) + 1;

        err.textContent = 'НЕВЕРНЫЕ ДАННЫЕ';
        passInput.value = '';
        dateInput.value = '';
        (okLogin ? passInput : loginInput).focus();

        const panel = gate.querySelector('.admin-panel');
        panel.classList.remove('admin-shake');
        void panel.offsetWidth;
        panel.classList.add('admin-shake');

        log('неверный пароль, попытка', fails);

        if (fails >= MAX_FAILS) {
            const until = Date.now() + LOCK_MS;
            store.set(LOCK_KEY, String(until));
            store.set(FAIL_KEY, '0');
            // «Закрыть на 30 секунд»
            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(function () {
                closeTimer = null;
                close();
            }, 900);
            return;
        }

        store.set(FAIL_KEY, String(fails));
    }

    function startLockTicker() {
        stopLockTicker();

        const tick = function () {
            const left = Math.ceil((getLockUntil() - Date.now()) / 1000);

            if (left <= 0) {
                stopLockTicker();
                renderLock(0);
                return;
            }

            renderLock(left);
        };

        tick();
        lockTicker = setInterval(tick, 250);
    }

    function stopLockTicker() {
        if (lockTicker) {
            clearInterval(lockTicker);
            lockTicker = null;
        }
    }

    function renderLock(left) {
        const inputs = gate.querySelectorAll('.admin-input');
        const submit = gate.querySelector('button[type="submit"]');
        const err = gate.querySelector('.admin-error');
        const note = gate.querySelector('.admin-lock-note');
        const locked = left > 0;

        inputs.forEach(function (el) { el.disabled = locked; });
        submit.disabled = locked;
        gate.classList.toggle('is-locked', locked);

        if (locked) {
            err.textContent = 'ЗАБЛОКИРОВАНО: ' + left + ' С';
            note.textContent = 'Слишком много попыток. Подождите.';
            note.classList.remove('admin-hidden');
        } else {
            if (err.textContent.indexOf('ЗАБЛОКИРОВАНО') === 0) err.textContent = '';
            note.textContent = '';
            note.classList.add('admin-hidden');
        }
    }

    // ---- ОТЛОЖЕННЫЙ ЗАПРОС ДАННЫХ ---------------------------
    function isScreenActive(id) {
        const el = document.getElementById(id);
        return !!(el && el.classList.contains('active'));
    }

    // ---- ПЕРЕХОДЫ -------------------------------------------
    // Останавливаем интро, иначе его async-сценарий сам сменит экран позже
    function stopIntro() {
        const intro = introMod();
        if (!intro) return;

        intro.skip = true;
        intro.finished = true;
        intro.isTyping = false;
        if (intro.currentInterval) {
            clearInterval(intro.currentInterval);
            intro.currentInterval = null;
        }
        if (typeof intro.removeClickHandler === 'function') intro.removeClickHandler();
    }

    function jumpTo(target) {
        const screen = screenMod();
        const loader = loaderMod();
        const intro = introMod();

        if (!target) return;

        // Убираем заставку техработ перед переходом на любой другой экран
        if (loader && typeof loader.hideMaintenance === 'function') loader.hideMaintenance();

        if (target === 'intro') {
            if (!screen || !intro) return flash('INTRO НЕДОСТУПНО');
            stopIntro();
            close();
            screen.showScreen('intro-screen');
            intro.init();
            log('jump intro');
            return;
        }

        stopIntro();

        switch (target) {
            case 'loader':
                if (!document.getElementById('loader-screen')) {
                    return flash('ЛОАДЕР УДАЛЁН ПОСЛЕ СТАРТА · ПЕРЕЗАГРУЗИТЕ');
                }
                if (!screen) return flash('SCREENMANAGER НЕ НАЙДЕН');
                close();
                screen.showScreen('loader-screen');
                break;

            case 'menu':
                if (!screen) return flash('SCREENMANAGER НЕ НАЙДЕН');
                close();
                screen.showScreen('main-menu');
                if (typeof MainMenu !== 'undefined') MainMenu.refreshPlayButton();
                break;

            case 'game':
                if (!screen) return flash('SCREENMANAGER НЕ НАЙДЕН');
                close();
                screen.showScreen('game-screen');
                break;

            case 'credits':
                if (!modalMod() || typeof Modal.openCredits !== 'function') {
                    return flash('CREDITS НЕДОСТУПНЫ');
                }
                close();
                Modal.openCredits();
                break;

            case 'help':
                if (!modalMod() || typeof Modal.openHelp !== 'function') {
                    return flash('HELP НЕДОСТУПЕН');
                }
                close();
                Modal.openHelp();
                break;

            case 'maintenance':
                if (!loader || typeof loader.showMaintenance !== 'function') {
                    return flash('LOADER НЕ НАЙДЕН');
                }
                if (!document.getElementById('loader-maintenance')) {
                    return flash('ЭКРАН ТЕХРАБОТ УДАЛЁН · ПЕРЕЗАГРУЗИТЕ');
                }
                close();
                loader.showMaintenance();
                break;
        }

        log('jump', target);
    }

    // ---- ФЛАГИ ----------------------------------------------
    function toggleDebug() {
        const loader = loaderMod();
        const current = loader ? !!loader.DEBUG_SIMULATE_ERROR : store.get(DEBUG_KEY) === 'true';
        const next = !current;

        if (loader) loader.DEBUG_SIMULATE_ERROR = next;
        store.set(DEBUG_KEY, next ? 'true' : 'false');
        syncToggles();
        flash(next ? 'СИМУЛЯЦИЯ ОШИБКИ ВКЛ · ПОСЛЕ ПЕРЕЗАГРУЗКИ' : 'СИМУЛЯЦИЯ ОШИБКИ ВЫКЛ');
        log('DEBUG_SIMULATE_ERROR =', next);
    }

    function toggleMaintenance() {
        const loader = loaderMod();
        const current = loader ? !!loader.MAINTENANCE_MODE : store.get(MAINT_KEY) === 'true';
        const next = !current;

        if (loader) loader.MAINTENANCE_MODE = next;
        store.set(MAINT_KEY, next ? 'true' : 'false');
        syncToggles();
        flash(next ? 'ТЕХРАБОТЫ ВКЛ · ПОСЛЕ ПЕРЕЗАГРУЗКИ' : 'ТЕХРАБОТЫ ВЫКЛ');
        log('MAINTENANCE_MODE =', next);
    }

    function toggleVerbose() {
        verbose = !verbose;
        store.set(VERBOSE_KEY, verbose ? 'true' : 'false');
        syncToggles();
        flash(verbose ? 'VERBOSE ВКЛ (ТОЛЬКО ЛОГИ АДМИНКИ)' : 'VERBOSE ВЫКЛ');
        log('verbose =', verbose);
    }

    // ---- ДЕЙСТВИЯ -------------------------------------------
    function skipLoading() {
        const loader = loaderMod();
        if (!isScreenActive('loader-screen') || !loader || typeof loader.showSuccessAndProceed !== 'function') {
            return flash('ЛОАДЕР СЕЙЧАС НЕ АКТИВЕН');
        }
        close();
        loader.showSuccessAndProceed();
        showToast('ЗАГРУЗКА ПРОПУЩЕНА');
        log('skip loading');
    }

    function skipIntro() {
        const intro = introMod();
        if (!isScreenActive('intro-screen') || !intro || typeof intro.finish !== 'function') {
            return flash('ИНТРО СЕЙЧАС НЕ АКТИВНО');
        }
        close();
        intro.finish();
        showToast('ИНТРО ПРОПУЩЕНО');
        log('skip intro');
    }

    function resetProgress() {
        const progress = progressMod();
        if (progress && typeof progress.clear === 'function') {
            progress.clear();
        } else {
            store.remove('amberfields_save');
        }

        if (typeof MainMenu !== 'undefined') MainMenu.refreshPlayButton();

        showToast('ПРОГРЕСС СБРОШЕН');
        syncInfo();
        flash('ПРОГРЕСС СБРОШЕН');
        log('progress reset');
    }

    function doWipe() {
        try {
            localStorage.clear();
        } catch (e) { /* ignore */ }
        window.location.reload();
    }

    function setConfirm(visible) {
        confirmVisible = visible;
        if (!stage) return;
        const box = stage.querySelector('.admin-confirm');
        if (!box) return;
        box.classList.toggle('admin-hidden', !visible);
    }

    function flash(text) {
        if (!stage) return;
        const fb = stage.querySelector('.admin-feedback');
        if (!fb) return;

        fb.textContent = text;
        fb.classList.add('visible');

        if (feedbackTimer) clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(function () {
            feedbackTimer = null;
            fb.classList.remove('visible');
        }, 2800);
    }

    // ---- ИНФОРМАЦИЯ -----------------------------------------
    function collectStorage() {
        const full = {};
        const preview = {};
        let bytes = 0;
        let count = 0;

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const val = value == null ? '' : value;

                full[key] = val;
                preview[key] = val.length > 100 ? val.slice(0, 100) + '…' : val;
                bytes += (key.length + val.length) * 2; // UTF-16
                count++;
            }
        } catch (e) {
            full.__error = 'localStorage недоступен';
            preview.__error = 'localStorage недоступен';
        }

        return {
            full: full,
            preview: preview,
            count: count,
            kb: (bytes / 1024).toFixed(2)
        };
    }

    function syncInfo() {
        if (!stage) return;

        const screenLine = stage.querySelector('[data-info-screen]');
        const jsonEl = stage.querySelector('[data-info-json]');
        const metaEl = stage.querySelector('[data-info-meta]');

        if (screenLine) {
            const active = document.querySelector('.screen.active');
            let text = active ? active.id : '—';

            const modal = modalMod();
            if (modal) {
                const layers = [];
                if (modal.activeModal) layers.push(modal.activeModal);
                if (modal.creditsOpen) layers.push('credits');
                if (modal.helpOpen) layers.push('help');
                if (modal.resetConfirmOpen) layers.push('reset-confirm');
                if (layers.length) text += ' + ' + layers.join(', ');
            }

            screenLine.textContent = text;
        }

        const data = collectStorage();
        lastFullDump = JSON.stringify(data.full, null, 2);

        if (jsonEl) jsonEl.textContent = JSON.stringify(data.preview, null, 2);
        if (metaEl) metaEl.textContent = 'КЛЮЧЕЙ: ' + data.count + ' · ~' + data.kb + ' КБ';
    }

    function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }).catch(function () {
                return legacyCopy(text);
            });
        }
        return Promise.resolve(legacyCopy(text));
    }

    function legacyCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        return ok;
    }

    function copyStorage() {
        syncInfo();
        copyText(lastFullDump).then(function (ok) {
            flash(ok ? 'LOCALSTORAGE СКОПИРОВАН' : 'НЕ УДАЛОСЬ СКОПИРОВАТЬ');
        });
    }

    function consoleHint() {
        flash('F12 / ПРАВАЯ КНОПКА → INSPECT · НА МОБИЛКЕ НЕДОСТУПНО');
        try {
            console.log('[Admin] Откройте DevTools: F12 или правая кнопка мыши → Inspect.');
        } catch (e) { /* ignore */ }
    }

    // ---- СИНХРОНИЗАЦИЯ UI -----------------------------------
    function setToggle(btn, on) {
        if (!btn) return;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        const state = btn.querySelector('[data-state]');
        if (state) state.textContent = on ? 'ВКЛ' : 'ВЫКЛ';
    }

    function syncToggles() {
        if (!stage) return;

        const loader = loaderMod();

        const debugOn = loader ? !!loader.DEBUG_SIMULATE_ERROR : store.get(DEBUG_KEY) === 'true';
        const maintOn = loader ? !!loader.MAINTENANCE_MODE : store.get(MAINT_KEY) === 'true';

        setToggle(stage.querySelector('[data-action="toggle-debug"]'), debugOn);
        setToggle(stage.querySelector('[data-action="toggle-maint"]'), maintOn);
        setToggle(stage.querySelector('[data-action="toggle-verbose"]'), verbose);
    }

    function setDisabled(selector, disabled) {
        const btn = stage.querySelector(selector);
        if (btn) btn.disabled = !!disabled;
    }

    function syncActions() {
        if (!stage) return;
        setDisabled('[data-action="skip-loading"]', !isScreenActive('loader-screen'));
        setDisabled('[data-action="skip-intro"]', !isScreenActive('intro-screen'));
    }

    function syncAll() {
        syncToggles();
        syncActions();
        syncInfo();
        setConfirm(false);
    }

    function onKeyDown(e) {
        if (!isOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            close();
        }
    }

    function checkHash() {
        if (window.location.hash.toLowerCase().indexOf('admin') !== -1) {
            if (!isOpen) open();
        }
    }

    // ---- ИНИЦИАЛИЗАЦИЯ --------------------------------------
    function init() {
        if (initialized) return;
        initialized = true;

        verbose = store.get(VERBOSE_KEY) === 'true';

        // Авто-вход по admins.js (до проверки #admin)
        tryLocalUnlock();

        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('hashchange', checkHash);

        checkHash();
        log('init');
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        open: open,
        close: close,
        init: init
    };
})();

// Для доступа из консоли и на случай поздней загрузки скрипта
window.Admin = Admin;
