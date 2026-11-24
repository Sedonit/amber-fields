const Intro = {
    skip: false,
    isTyping: false,
    currentInterval: null,
    typingCompleteCallback: null,
    clickHandler: null,
    finished: false,

    // Скорость автобуса (синхронизирована с анимацией driveRightToLeft в intro.css)
    BUS_DRIVE_MS: 14000,
    BUS_SPRITE_MS: 180,

    async init() {
        // Сброс всех настроек при каждом новом запуске
        this.skip = false;
        this.isTyping = false;
        this.finished = false;
        this.removeClickHandler();
        if (this.currentInterval) clearInterval(this.currentInterval);

        document.querySelectorAll('.intro-scene').forEach(el => el.classList.remove('active'));
        document.getElementById('intro-text').style.opacity = '1';
        document.getElementById('intro-text').textContent = '';
        document.getElementById('intro-text').classList.remove('is-typing', 'waiting');
        document.getElementById('dialogue-text').textContent = '';
        document.getElementById('dialogue-text').classList.remove('is-typing');
        document.getElementById('dialogue-text').style.opacity = '1';
        document.getElementById('dialogue-role').textContent = '';
        document.getElementById('dialogue-role').removeAttribute('data-who');
        document.getElementById('dialogue-next').classList.remove('visible');

        document.getElementById('phone-incoming').classList.remove('show');
        document.getElementById('phone-accept').classList.remove('show');
        document.getElementById('bus-img').classList.remove('drive');
        document.getElementById('bus-img').src = "assets/images/intro/bus-1.png";

        // Кнопка пропуска
        const skipBtn = document.getElementById('btn-skip-intro');
        const newSkipBtn = skipBtn.cloneNode(true); // Убираем старые обработчики
        skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
        newSkipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.skip = true;
            this.finish();
        });

        await this.play();
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, this.skip ? 0 : ms));
    },

    typeText(text, elementId = 'intro-text', speed = 40) {
        return new Promise(resolve => {
            if (this.currentInterval) clearInterval(this.currentInterval);

            const el = document.getElementById(elementId);
            el.textContent = '';

            if (this.skip) {
                el.textContent = text;
                el.classList.remove('is-typing');
                resolve();
                return;
            }

            this.isTyping = true;
            el.classList.add('is-typing');
            this.typingCompleteCallback = resolve;
            let i = 0;

            this.finishTyping = () => {
                if (!this.isTyping) return;
                clearInterval(this.currentInterval);
                this.isTyping = false;
                el.classList.remove('is-typing');
                el.textContent = text;
                if (this.typingCompleteCallback) {
                    this.typingCompleteCallback();
                    this.typingCompleteCallback = null;
                }
            };

            this.currentInterval = setInterval(() => {
                if (i < text.length) {
                    i++;
                    // textContent безопасен и не ломает теги
                    el.textContent = text.substring(0, i);
                } else {
                    this.finishTyping();
                }
            }, speed);
        });
    },

    waitForClick() {
        return new Promise(resolve => {
            // Скип уже нажат — не ждём клика и не вешаем обработчик
            if (this.skip) { resolve(); return; }

            const screen = document.getElementById('intro-screen');
            const introText = document.getElementById('intro-text');

            // На всякий случай снимаем предыдущий обработчик, чтобы не копить их
            this.removeClickHandler();

            // В диалоге уже есть своя стрелочка на панели, подсказка нужна только рассказчику
            const dialogueActive = document.getElementById('scene-dialogue').classList.contains('active');
            if (!dialogueActive) introText.classList.add('waiting');

            const proceed = () => {
                introText.classList.remove('waiting');
                resolve();
            };

            this.clickHandler = (e) => {
                if (e.target.closest('#btn-skip-intro')) return;

                if (this.isTyping) {
                    this.finishTyping();
                    return; // Клик завершил печать, ждем следующий клик для продолжения
                }

                this.removeClickHandler();
                proceed();
            };
            screen.addEventListener('click', this.clickHandler);
        });
    },

    removeClickHandler() {
        if (!this.clickHandler) return;
        const screen = document.getElementById('intro-screen');
        if (screen) screen.removeEventListener('click', this.clickHandler);
        this.clickHandler = null;
    },

    showScene(sceneId) {
        document.querySelectorAll('.intro-scene').forEach(el => el.classList.remove('active'));
        const scene = document.getElementById(sceneId);
        if (scene) scene.classList.add('active');
    },

    async play() {
        if (this.skip) return this.finish();

        // 1. ОФИС
        this.showScene('scene-office');
        await this.sleep(1000);
        await this.typeText("Вторник, 9:47.\nКофе остыл ещё в семь.\nЕщё один день,\nкоторый никто не запомнит.");
        await this.waitForClick();
        if (this.skip) return this.finish();

        // 2. ЗВОНОК
        this.showScene('scene-phone');
        await this.sleep(500);
        document.getElementById('phone-incoming').classList.add('show');

        await this.typeText("Среди уведомлений —\nодно без фото и без скидки.\n\n«Продам ферму. Недорого.\nСамовывоз.»\n\nНи адреса. Только номер.");
        await this.waitForClick();
        if (this.skip) return this.finish();

        document.getElementById('phone-incoming').classList.remove('show');
        document.getElementById('phone-accept').classList.add('show');
        await this.sleep(300);

        await this.typeText("Тот самый номер.\nТы отвечаешь раньше,\nчем успеваешь придумать, зачем.");
        await this.waitForClick();
        if (this.skip) return this.finish();

        // 3. ДИАЛОГ
        document.getElementById('intro-text').style.opacity = '0';
        this.showScene('scene-dialogue');
        const nextArrow = document.getElementById('dialogue-next');
        const roleEl = document.getElementById('dialogue-role');
        const textEl = document.getElementById('dialogue-text');

        await this.sleep(500);

        const dialog = [
            { role: "ДЕД", who: "ded", text: "Алло? Внучок? Это дед." },
            { role: "ТЫ", who: "you", text: "Дед... ты правда продаёшь ферму?" },
            { role: "ДЕД", who: "ded", text: "Не продаю. Отдаю.\nПриезжай, пока я не передумал." },
            { role: "ТЫ", who: "you", text: "Почему сейчас?" },
            { role: "ДЕД", who: "ded", text: "Дом стоит. Земля ждёт.\nА я устал ждать один." },
            { role: "ТЫ", who: "you", text: "Я же ничего в этом не понимаю." },
            { role: "ДЕД", who: "ded", text: "Научишься. Остальное — на месте.\nЕсть только один нюанс." },
            { role: "ТЫ", who: "you", text: "Какой?" },
            { role: "ДЕД", who: "ded", text: "Енот. Он не мой.\nНо ты его не обижай.\nЛадно, автобус ждёт." }
        ];

        for (let i = 0; i < dialog.length; i++) {
            const line = dialog[i];
            nextArrow.classList.remove('visible');

            // Мягкая смена реплики: старая гаснет, новая появляется
            textEl.style.opacity = '0';
            await this.sleep(140);
            roleEl.textContent = line.role;
            roleEl.dataset.who = line.who;
            textEl.style.opacity = '1';

            await this.typeText(line.text, 'dialogue-text', 30);

            // Даем глазу привыкнуть к тексту (0.4 сек)
            await this.sleep(400);

            nextArrow.classList.add('visible');
            await this.waitForClick();

            if (this.skip) return this.finish();
        }

        nextArrow.classList.remove('visible');
        // 4. АВТОБУС
        const introTextEl = document.getElementById('intro-text');
        introTextEl.textContent = ''; 
        introTextEl.style.opacity = '1'; 

        this.showScene('scene-bus');
        await this.sleep(500);

        await this.typeText("Неделя.\nОдин чемодан.\nИ ни одного плана.");

        const busImg = document.getElementById('bus-img');
        busImg.classList.add('drive');

        const busInterval = setInterval(() => {
            if (this.skip) return;
            busImg.src = busImg.src.includes('bus-1')
                ? "assets/images/intro/bus-2.png"
                : "assets/images/intro/bus-1.png";
        }, this.BUS_SPRITE_MS);

        // Ждём почти до конца поездки автобуса (14 секунд)
        await this.sleep(this.BUS_DRIVE_MS - 800);

        // 🎯 ПЛАВНОЕ ЗАТУХАНИЕ: текст гаснет пока автобус ещё доезжает
        introTextEl.style.opacity = '0';
        await this.sleep(1000); // Даём transition (0.6s) полностью отработать

        clearInterval(busInterval);
        if (this.skip) return this.finish();

        // 5. ДОМ
        this.showScene('scene-house');
        await this.sleep(900); // Даём сцене дома плавно проявиться (0.9s transition)

        // 🎯 ПЛАВНОЕ ПОЯВЛЕНИЕ: новый текст проявляется вместе с началом печати
        introTextEl.textContent = '';
        introTextEl.style.opacity = '1';
        await this.sleep(100); // Микро-пауза, чтобы opacity-transition начался

        await this.typeText("Асфальт позади.\nПоле впереди.\nТишина такая, что слышно,\nкак ты дышишь.\n\nПочти.");

        await this.waitForClick();
        this.finish();
    },

    finish() {
        if (this.finished) return;
        this.finished = true;
        this.skip = true;
        this.removeClickHandler();

        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }

        // Убираем курсор печати и подсказку, если скип застал текст на середине
        document.querySelectorAll('#intro-screen .is-typing').forEach(el => el.classList.remove('is-typing'));
        document.getElementById('intro-text').classList.remove('waiting');

        // Разблокируем play(), если печать ещё шла в момент скипа
        if (this.typingCompleteCallback) {
            const done = this.typingCompleteCallback;
            this.typingCompleteCallback = null;
            this.isTyping = false;
            done();
        }

        // Интро пройдено — игра считается начатой.
        // При следующем заходе в меню будет «Продолжить» вместо «Играть».
        Progress.start();

        const intro = document.getElementById('intro-screen');
        intro.style.transition = 'opacity 1s ease';
        intro.style.opacity = '0';

        setTimeout(() => {
            intro.classList.add('hidden');
            intro.style.opacity = '1'; // Возвращаем на место для следующего раза
            ScreenManager.showScreen('game-started-screen');
        }, 1000);
    }
};
