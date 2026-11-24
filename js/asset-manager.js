// === МЕНЕДЖЕР ЛЕНИВОЙ ЗАГРУЗКИ АССЕТОВ ===
// Группирует файлы в логические бандлы и подгружает их по требованию.
const AssetManager = {

    // Описание бандлов: какие картинки и звуки входят в каждый пакет
    bundles: {
        // Базовый пакет: экран загрузки + главное меню
        core: {
            images: [
                'assets/images/loading.png',
                'assets/images/ui/bg.webp',
                'assets/images/ui/cloud-1.webp',
                'assets/images/ui/cloud-2.webp',
                'assets/images/ui/smoke-1.webp',
                'assets/images/ui/smoke-2.webp'
            ],
            audio: [
                'assets/audio/sfx/success.mp3'
            ]
        },

        // Интро: грузим только когда игрок нажимает «Играть» впервые
        intro: {
            images: [
                'assets/images/intro/office.webp',
                'assets/images/intro/house.webp',
                'assets/images/intro/phone-incoming.webp',
                'assets/images/intro/phone-accept.webp',
                'assets/images/intro/bus-1.png',
                'assets/images/intro/bus-2.png'
            ],
            audio: []
        },

        // Интерфейс: иконки, фоны модалок и звуки кликов (задел на будущее)
        ui: {
            images: [],
            audio: []
        },

        // Игровые ассеты: спрайты, объекты, музыка (задел на будущее)
        game: {
            images: [],
            audio: []
        }
    },

    // Уже загруженные бандлы
    loadedBundles: new Set(),

    // Бандлы, которые грузятся прямо сейчас (чтобы не дублировать запросы)
    _pending: {},

    // Загрузить бандл по имени. Возвращает Promise.
    loadBundle(name) {
        const bundle = this.bundles[name];

        if (!bundle) {
            console.warn(`[AssetManager] Неизвестный бандл: "${name}"`);
            return Promise.reject(new Error(`Неизвестный бандл: ${name}`));
        }

        // Уже загружен — мгновенно
        if (this.loadedBundles.has(name)) {
            return Promise.resolve();
        }

        // Уже грузится — отдаём тот же промис
        if (this._pending[name]) {
            return this._pending[name];
        }

        const images = (bundle.images || []).map(src => this._loadImage(src));
        const audio = (bundle.audio || []).map(src => this._loadAudio(src));
        const tasks = images.concat(audio);

        // Бандл без файлов — просто отмечаем загруженным
        if (!tasks.length) {
            this.loadedBundles.add(name);
            return Promise.resolve();
        }

        const promise = Promise.all(tasks)
            .then(results => {
                this._pending[name] = null;

                const failed = results.filter(ok => !ok).length;
                if (failed > 0) {
                    // Часть файлов не загрузилась — сообщаем вызывающему коду
                    throw new Error(`Бандл "${name}": не загружено файлов — ${failed}`);
                }

                this.loadedBundles.add(name);
                return true;
            })
            .catch(error => {
                this._pending[name] = null;
                console.warn(`[AssetManager] Ошибка загрузки бандла "${name}":`, error.message);
                throw error;
            });

        this._pending[name] = promise;
        return promise;
    },

    // Загрузка картинки. Ошибка не ломает игру — только предупреждение.
    _loadImage(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => {
                console.warn(`[AssetManager] Не загрузилась картинка: ${src}`);
                resolve(false);
            };
            img.src = src;
        });
    },

    // Загрузка звука. Ошибка не ломает игру — только предупреждение.
    _loadAudio(src) {
        return new Promise(resolve => {
            let settled = false;
            let timeoutId = null;

            const finish = ok => {
                if (settled) return;
                settled = true;
                if (timeoutId) clearTimeout(timeoutId);
                if (!ok) console.warn(`[AssetManager] Не загрузился звук: ${src}`);
                resolve(ok);
            };

            const audio = new Audio();
            audio.preload = 'auto';
            audio.oncanplaythrough = () => finish(true);
            audio.onerror = () => finish(false);
            audio.src = src;
            audio.load();

            // Звук не должен держать загрузку вечно
            timeoutId = setTimeout(() => finish(true), 15000);
        });
    }
};
