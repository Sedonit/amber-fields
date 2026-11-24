const Loader = {

    // --- НАСТРОЙКИ ТЕСТИРОВАНИЯ И ТЕХРАБОТ ---
    MAINTENANCE_MODE: false, // true = включить техработы и заблокировать игру
    MAINTENANCE_REASON: "Енот пробрался в серверную и устроил там свою ферму. Чиним провода, греем лампы и разгоняем звёзды — скоро вернёмся. Ориентировочно: 04.02.2027, 18:00", // Текст причины
    MAINTENANCE_VIDEO: "assets/video/raccoon.mp4", // ← Путь к видосику

    // --- НАСТРОЙКИ ТЕСТИРОВАНИЯ ---
    DEBUG_SIMULATE_ERROR: false, // true = симуляция ошибки включена, false = боевой режим
    DEBUG_ERROR_DELAY: 2000,     // через сколько миллисекунд произойдет сбой (2000 = 2 сек)
    // ------------------------------

    maintenanceBox: null,
    maintenanceMessage: null,
    progressBar: null,
    statusText: null,
    hintText: null,
    warningBox: null,
    successBox: null,
    loaderGif: null,
    btnRetry: null,
    btnContinue: null,
    errorBox: null,
    errorText: null,
    warningText: null,
    btnWait: null,
    btnWarningRetry: null,
    progressInterval: null,
    completionTimer: null,
    warningTimer: null,

    hadRetry: false, // Флаг: нажимал ли пользователь "Повторить попытку"

    startTime: 0,
    minLoadTime: 5000,       // Обязательные 5 секунд
    runMinTime: 5000,        // Минимум для текущей попытки (у повтора короче)
    warningDelay: 8000,      // Жёлтый флаг, если грузится дольше 8 секунд
    warningRepeat: 20000,    // Повторное напоминание, если решили подождать

    runId: 0,                // Номер попытки: старые колбэки не должны ломать новую
    failedAssets: [],

    loadedCount: 0,
    totalCount: 0,
    hasError: false,

    showMaintenance() {
        // Останавливаем вращение советов, если оно запускалось
        if (this.hintInterval) clearInterval(this.hintInterval);
        if (this.progressInterval) clearInterval(this.progressInterval);

        if (this.maintenanceMessage && this.MAINTENANCE_REASON) {
            this.maintenanceMessage.textContent = this.MAINTENANCE_REASON;
        }

        // Задаем путь к видео из настроек
        const videoElem = document.getElementById('maintenance-video');
        if (videoElem && this.MAINTENANCE_VIDEO) {
            videoElem.src = this.MAINTENANCE_VIDEO;
            // Свечение вокруг кружка подхватывает цвет кадров ролика
            if (typeof Ambient !== 'undefined') Ambient.followVideo(videoElem, '#maintenance-ambient');
        }

        this.buildMaintenanceScene();

        if (this.maintenanceBox) {
            this.maintenanceBox.classList.remove('hidden-element');
        }
    },

    hideMaintenance() {
        const box = this.maintenanceBox || document.getElementById('loader-maintenance');
        if (box) box.classList.add('hidden-element');
    },

    // Звёзды и светлячки для атмосферного фона техработ
    _maintenanceSceneBuilt: false,
    buildMaintenanceScene() {
        if (this._maintenanceSceneBuilt) return;

        const starsBox = document.getElementById('maintenance-stars');
        const firefliesBox = document.getElementById('maintenance-fireflies');
        if (!starsBox && !firefliesBox) return;

        const rand = (min, max) => min + Math.random() * (max - min);

        if (starsBox) {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 64; i++) {
                const star = document.createElement('span');
                star.className = 'mstar' + (Math.random() > 0.88 ? ' mstar--big' : '');
                star.style.setProperty('--x', rand(0, 100).toFixed(2) + '%');
                // Больше звёзд в верхней части неба
                star.style.setProperty('--y', (Math.pow(Math.random(), 1.35) * 68).toFixed(2) + '%');
                star.style.setProperty('--s', rand(1.2, 2.6).toFixed(1) + 'px');
                star.style.setProperty('--dur', rand(2.4, 6.5).toFixed(2) + 's');
                star.style.setProperty('--delay', rand(0, 6).toFixed(2) + 's');
                fragment.appendChild(star);
            }
            starsBox.appendChild(fragment);
        }

        if (firefliesBox) {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 16; i++) {
                const fly = document.createElement('span');
                fly.className = 'mfirefly';
                fly.style.setProperty('--x', rand(4, 96).toFixed(2) + '%');
                fly.style.setProperty('--y', rand(62, 94).toFixed(2) + '%');
                fly.style.setProperty('--s', rand(2, 4).toFixed(1) + 'px');
                fly.style.setProperty('--dur', rand(6, 12).toFixed(2) + 's');
                fly.style.setProperty('--delay', rand(0, 8).toFixed(2) + 's');
                fragment.appendChild(fly);
            }
            firefliesBox.appendChild(fragment);
        }

        this._maintenanceSceneBuilt = true;
    },

    hints: [
        "Совет: Чем выше ваша репутация, тем щедрее покупатели и заказы!",
        "Совет: Не забывайте поливать грядки, чтобы быстрее собрать урожай.",
        "Совет: Вы можете корректировать цены в лавке в зависимости от спроса и типа товара.",
        "Совет: Если покупатель долго ждет, его настроение снижается и он может уйти!",
        "Совет: Оптовые продажи помогают быстро освободить склад, но вы будете получать меньше дохода.",
        "Совет: Разные культуры растут с разной скоростью — планируйте посадки заранее.",
        "Совет: Следите за балансом: если закончатся деньги, новые семена вам не светят.",
        "Совет: Недовольство покупателей снижает общую репутацию вашего магазина, следите за ней.",
        "Совет: Внимательно проверяйте рыночную стоимость товара, прежде чем выставлять высокие цены.",
        "Совет: Следите, чтобы енот не украл у вас растения или товары!",
        "Совет: Выгонять покупателей можно, но вы же не хотите этого, верно?..",
        "Совет: Регулярно обновляйте ассортимент на полках, чтобы привлечь больше людей.",
        "Совет: При высоком спросе цену можно немного поднять.",
        "Совет: Когда нанимаете помощника, не забывайте, что без монет в кармане работать он не будет.",
        "Совет: Возможно, с енотом можно договориться. Кто знает? Спросите у разработчика как."
    ],
    hintInterval: null,

    // Флаги из скрытой админ-панели: читаем до проверки режима техработ
    applyAdminFlags() {
        try {
            const savedDebug = localStorage.getItem('admin_DEBUG_ERROR');
            const savedMaint = localStorage.getItem('admin_MAINTENANCE');
            if (savedDebug !== null) this.DEBUG_SIMULATE_ERROR = savedDebug === 'true';
            if (savedMaint !== null) this.MAINTENANCE_MODE = savedMaint === 'true';
        } catch (e) {
            // localStorage может быть недоступен — работаем со значениями по умолчанию
        }
    },

    init() {
        this.applyAdminFlags();

        this.maintenanceBox = document.getElementById('loader-maintenance');
        this.maintenanceMessage = document.getElementById('maintenance-message');

        // Если включен режим техработ — блокируем всё и останавливаем запуск
        if (this.MAINTENANCE_MODE) {
            this.showMaintenance();
            return;
        }

        this.progressBar = document.getElementById('progress-bar');
        this.statusText = document.getElementById('loader-status');
        this.hintText = document.getElementById('loader-hint');
        this.warningBox = document.getElementById('loader-warning');
        this.warningText = document.getElementById('warning-text');
        this.errorBox = document.getElementById('loader-error');
        this.errorText = document.getElementById('error-text');
        this.successBox = document.getElementById('loader-success');
        this.loaderGif = document.getElementById('loader-gif');
        this.btnRetry = document.getElementById('btn-retry');
        this.btnContinue = document.getElementById('btn-continue');
        this.btnWait = document.getElementById('btn-wait');
        this.btnWarningRetry = document.getElementById('btn-warning-retry');

        if (this.btnRetry) {
            this.btnRetry.addEventListener('click', () => {
                this.hadRetry = true; // Запоминаем, что клик по повтору уже был
                this.retryLoading();
            });
        }

        // Жёлтый флаг: «подождать ещё» или «перезапустить»
        if (this.btnWait) {
            this.btnWait.addEventListener('click', () => this.dismissSlowWarning());
        }
        if (this.btnWarningRetry) {
            this.btnWarningRetry.addEventListener('click', () => {
                this.hadRetry = true;
                this.retryLoading();
            });
        }
        // Клик по кнопке "Продолжить"
        if (this.btnContinue) {
            this.btnContinue.addEventListener('click', () => {
                this.btnContinue.classList.add('hidden-element');
                this.showSuccessAndProceed();
            });
        }
        
        this.startHintLoop();

        // Базовый бандл (загрузчик + меню) грузим через AssetManager,
        // затем запускаем визуальный прогресс.
        const startProgress = () => this.startLoadingProcess();
        if (typeof AssetManager !== 'undefined') {
            AssetManager.loadBundle('core').then(startProgress, startProgress);
        } else {
            startProgress();
        }

        if (this.btnContinue) this.btnContinue.classList.add('hidden-element');
        
    },

    startHintLoop() {
        let lastIndex = Math.floor(Math.random() * this.hints.length);
        this.showNextHint(lastIndex);
        
        if (this.hintInterval) clearInterval(this.hintInterval);
        this.hintInterval = setInterval(() => {
            let newIndex;
            do {
                newIndex = Math.floor(Math.random() * this.hints.length);
            } while (newIndex === lastIndex && this.hints.length > 1);
            
            lastIndex = newIndex;
            this.showNextHint(newIndex);
        }, 3500);
    },

    showNextHint(index) {
        if (this.hintText) {
            this.hintText.textContent = this.hints[index];
        }
    },

    // Файлы ядра грузит AssetManager, поэтому здесь только визуальный прогресс.
    // Держим таймер на 5 секунд, чтобы загрузчик успел показать анимацию и советы.
    startLoadingProcess() {
        // Номер попытки: колбэки от прошлого запуска больше не трогают экран
        const run = ++this.runId;

        this.startTime = Date.now();
        this.hasError = false;
        this.failedAssets = [];
        this.loadedCount = 0;
        this.totalCount = 1;
        this.runMinTime = this.minLoadTime;

        this.resetLoaderUI();
        this.progressInterval = setInterval(() => this.updateProgress(), 50);

        // Жёлтый флаг, если загрузка затянулась
        this.scheduleSlowWarning(run, this.warningDelay);

        // === ТОЧКА СИМУЛЯЦИИ ОШИБКИ ===
        if (this.DEBUG_SIMULATE_ERROR && !this.hadRetry) {
            setTimeout(() => {
                if (run !== this.runId) return;
                this.handleNetworkError(run);
            }, this.DEBUG_ERROR_DELAY);
            return;
        }

        // Ждём минимальное время и только потом завершаем загрузку
        this.waitForMinimumTime(run);
    },

    resetLoaderUI() {
        if (this.progressInterval) clearInterval(this.progressInterval);
        if (this.completionTimer) clearInterval(this.completionTimer);
        this.completionTimer = null;
        this.clearSlowWarningTimer();

        if (this.warningBox) this.warningBox.classList.add('hidden-element');
        if (this.errorBox) this.errorBox.classList.add('hidden-element');
        if (this.btnRetry) {
            this.btnRetry.classList.add('hidden-element');
            this.btnRetry.textContent = '↻ Повторить попытку';
        }
        if (this.btnContinue) this.btnContinue.classList.add('hidden-element');
        if (this.successBox) this.successBox.classList.add('hidden-element');
        if (this.loaderGif) this.loaderGif.classList.remove('dimmed');
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
            this.progressBar.classList.remove('is-stalled', 'is-error');
        }
        if (this.statusText) {
            this.statusText.classList.remove('long-wait', 'is-error');
            this.statusText.style.color = '';
        }
        this.setStatus('Загрузка ресурсов... 0%');
    },

    setStatus(text, tone) {
        if (!this.statusText) return;
        this.statusText.textContent = text;
        this.statusText.classList.remove('long-wait', 'is-error');
        if (tone === 'slow') this.statusText.classList.add('long-wait');
        if (tone === 'error') this.statusText.classList.add('is-error');
    },

    // Даём прогрессу доиграть до 5 секунд, но не после ошибки
    waitForMinimumTime(run) {
        if (this.completionTimer) clearInterval(this.completionTimer);

        this.completionTimer = setInterval(() => {
            if (run !== this.runId) {
                clearInterval(this.completionTimer);
                this.completionTimer = null;
                return;
            }
            if (this.hasError) {
                clearInterval(this.completionTimer);
                this.completionTimer = null;
                return;
            }
            if (Date.now() - this.startTime < this.runMinTime) return;

            clearInterval(this.completionTimer);
            this.completionTimer = null;
            this.finishLoading(run);
        }, 100);
    },

    finishLoading(run) {
        if (run !== this.runId) return;

        this.clearSlowWarningTimer();
        if (this.progressInterval) clearInterval(this.progressInterval);

        if (this.warningBox) this.warningBox.classList.add('hidden-element');
        if (this.progressBar) {
            this.progressBar.classList.remove('is-stalled');
            this.progressBar.style.width = '100%';
        }
        this.setStatus('Загрузка завершена!');

        if (this.hadRetry) {
            this.showSuccessAndProceed();
        } else if (this.btnContinue) {
            this.btnContinue.classList.remove('hidden-element');
        }
    },

    handleNetworkError(run) {
        if (this.hasError || run !== this.runId) return;
        this.hasError = true;

        if (this.progressInterval) clearInterval(this.progressInterval);
        if (this.completionTimer) clearInterval(this.completionTimer);
        this.completionTimer = null;
        this.clearSlowWarningTimer();

        const names = this.failedAssets.map(asset => this.prettyAssetName(asset.src));

                if (this.errorText) {
            if (names.length === 1) {
                this.errorText.textContent = `Файл «${names[0]}» не загрузился. Проверь соединение и попробуй снова.`;
            } else if (names.length > 1) {
                const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '');
                this.errorText.textContent = `Не загрузилось файлов: ${names.length} (${preview}). Проверь соединение и попробуй снова.`;
            } else {
                // Специально для симуляции ошибки (когда упавших файлов нет)
                this.errorText.textContent = `Енот перегрыз интернет-кабель! Проверь соединение и попробуй снова.`;
            }
        }

        if (this.warningBox) this.warningBox.classList.add('hidden-element');
        if (this.errorBox) this.errorBox.classList.remove('hidden-element');
        if (this.progressBar) {
            this.progressBar.classList.remove('is-stalled');
            this.progressBar.classList.add('is-error');
        }
        if (this.loaderGif) this.loaderGif.classList.add('dimmed');
        if (this.btnContinue) this.btnContinue.classList.add('hidden-element');

        this.setStatus('Ошибка загрузки', 'error');

        if (this.btnRetry) {
            this.btnRetry.textContent = names.length > 1
                ? `↻ Повторить (${names.length})`
                : '↻ Повторить попытку';
            this.btnRetry.classList.remove('hidden-element');
        }
    },

    prettyAssetName(src) {
        return String(src).split('/').pop() || String(src);
    },

    scheduleSlowWarning(run, delay) {
        this.clearSlowWarningTimer();

        this.warningTimer = setTimeout(() => {
            if (run !== this.runId || this.hasError) return;
            this.showSlowWarning();
        }, delay);
    },

    clearSlowWarningTimer() {
        if (this.warningTimer) clearTimeout(this.warningTimer);
        this.warningTimer = null;
    },

    // Жёлтый флажок: грузится долго, но не сломалось
    showSlowWarning() {
        if (this.hasError) return;

        if (this.warningText) {
            const total = this.totalCount;
            const loaded = Math.min(this.loadedCount, total);
            this.warningText.textContent = total > 1
                ? `Загружено ${loaded} из ${total}. Соединение медленнее обычного — файлы всё ещё идут.`
                : 'Соединение медленнее обычного — файлы всё ещё идут.';
        }

        if (this.warningBox) this.warningBox.classList.remove('hidden-element');
        if (this.progressBar) this.progressBar.classList.add('is-stalled');
        if (this.statusText) this.statusText.classList.add('long-wait');
    },

    dismissSlowWarning() {
        if (this.warningBox) this.warningBox.classList.add('hidden-element');
        if (this.progressBar) this.progressBar.classList.remove('is-stalled');
        if (this.statusText) this.statusText.classList.remove('long-wait');

        // Если так и не догрузится — напомним ещё раз
        this.scheduleSlowWarning(this.runId, this.warningRepeat);
    },

    retryLoading() {
        this.hadRetry = true;
        // Ресурсы грузит AssetManager, поэтому просто перезапускаем визуальный прогресс
        this.startLoadingProcess();
    },

    showSuccessAndProceed() {
        clearInterval(this.hintInterval);
        if (this.progressInterval) clearInterval(this.progressInterval);
        if (this.completionTimer) clearInterval(this.completionTimer);
        this.completionTimer = null;
        this.clearSlowWarningTimer();

        if (this.loaderGif) this.loaderGif.classList.add('dimmed');
        if (this.warningBox) this.warningBox.classList.add('hidden-element');
        if (this.errorBox) this.errorBox.classList.add('hidden-element');
        if (this.btnRetry) this.btnRetry.classList.add('hidden-element');
        if (this.btnContinue) this.btnContinue.classList.add('hidden-element');
        if (this.progressBar) this.progressBar.classList.remove('is-stalled', 'is-error');
        if (this.successBox) this.successBox.classList.remove('hidden-element');
        this.setStatus("Загрузка завершена!");

        this.playSuccessSound();

        setTimeout(() => {
            this.onComplete();
        }, 1500);
    },

    playSuccessSound() {
        try {
            const audio = new Audio('assets/audio/sfx/success.mp3');
            audio.volume = 0.6;
            
            // Воспроизводим звук
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log("Браузер заблокировал автозвук до первого клика пользователя на странице:", error);
                });
            }
        } catch (e) {
            console.log("Ошибка воспроизведения звука:", e);
        }
    },

    updateProgress() {
        if (this.hasError) return;

        // Реальные файлы грузит AssetManager, поэтому прогресс визуальный —
        // плавно заполняем шкалу за отведённые 5 секунд.
        const elapsedTime = Date.now() - this.startTime;
        const displayPercent = Math.floor(Math.min(100, (elapsedTime / this.runMinTime) * 100));

        if (this.progressBar) this.progressBar.style.width = displayPercent + '%';
        if (this.statusText) {
            this.statusText.textContent = `Загрузка ресурсов... ${displayPercent}%`;
        }
    },

    // Освобождаем DOM загрузчика, когда он больше не нужен.
    // Экран техработ оставляем в DOM (скрытым) для админ-панели.
    disposed: false,
    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        if (this.hintInterval) clearInterval(this.hintInterval);
        if (this.progressInterval) clearInterval(this.progressInterval);
        if (this.completionTimer) clearInterval(this.completionTimer);
        this.clearSlowWarningTimer();
        this.hintInterval = null;
        this.progressInterval = null;
        this.completionTimer = null;

        const screen = document.getElementById('loader-screen');
        if (screen) screen.remove();

        // Экран техработ не удаляем: админка должна уметь открыть его
        // в любой момент, даже после старта игры. Держим скрытым.
        if (this.maintenanceBox) this.maintenanceBox.classList.add('hidden-element');

        this.progressBar = null;
        this.statusText = null;
        this.hintText = null;
        this.warningBox = null;
        this.warningText = null;
        this.successBox = null;
        this.loaderGif = null;
        this.btnRetry = null;
        this.btnContinue = null;
        this.errorBox = null;
        this.errorText = null;
        this.btnWait = null;
        this.btnWarningRetry = null;
    },

    onComplete() {
    const curtain = document.getElementById('transition-curtain');

    if (!curtain) {
        ScreenManager.showScreen('main-menu');
        return;
    }

    // 1. Занавес плавно закрывает экран
    curtain.classList.add('active');

    // 2. Через 550мс (пока занавес полностью чёрный) — переключаем экран
    setTimeout(() => {
        ScreenManager.showScreen('main-menu');

        // 3. Через 300мс (menu уже готов показаться) — открываем занавес
        setTimeout(() => {
            curtain.classList.remove('active');
        }, 300);
    }, 550);
}
};

// Менеджер экранов
const ScreenManager = {
    THEME_CLASSES: ['theme-loader', 'theme-menu', 'theme-intro', 'theme-game', 'theme-credits', 'theme-help'],

    showScreen(screenId) {
        // 1. Скрываем все экраны
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            s.classList.add('hidden');
        });
        
        // 2. Показываем нужный
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.remove('hidden');
            void target.offsetWidth;
            target.classList.add('active');
        }

        // 3. Меняем тему фона, снимая только классы тем (остальные классы body не трогаем)
        document.body.classList.remove(...this.THEME_CLASSES);
        if (screenId === 'loader-screen') document.body.classList.add('theme-loader');
        else if (screenId === 'main-menu') document.body.classList.add('theme-menu');
        else if (screenId === 'intro-screen') document.body.classList.add('theme-intro');
        else if (screenId === 'game-screen') document.body.classList.add('theme-game');
        else if (screenId === 'game-started-screen') document.body.classList.add('theme-menu');

        if (screenId === 'game-screen' || screenId === 'game-started-screen') {
            this.releaseBootUI();
        } else if (screenId === 'main-menu' && typeof Modal !== 'undefined') {
            // Список помощи готовим в простое, когда меню уже на экране
            Modal.scheduleHelpRender();
        }
    },

    // После старта игры меню/лоадер в этой сессии не используются — освобождаем память
    releaseBootUI() {
        if (typeof Modal !== 'undefined' && typeof Modal.releaseForGame === 'function') {
            Modal.releaseForGame();
        }
        if (typeof Loader !== 'undefined' && typeof Loader.dispose === 'function') {
            Loader.dispose();
        }
    },
    
    // Отдельный метод для оверлеев (Титры, Помощь)
    setAmbientTheme(themeName) {
        document.body.classList.remove(...this.THEME_CLASSES);
        document.body.classList.add('theme-' + themeName);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    Loader.init();
});
