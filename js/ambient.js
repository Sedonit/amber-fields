// YouTube-style ambient: фон, который живёт вместе с экраном и подхватывает цвет видео
const Ambient = {
    stage: null,
    _reduced: false,
    _active: null,
    _timer: null,
    _generation: 0,

    init() {
        this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // На узких экранах ambient-слои не нужны — экономим батарею и GPU
        const wide = window.matchMedia('(min-width: 900px)');
        if (wide.matches) this._buildStage();
        // Окно раздвинули до десктопного размера — включаем слои без перезагрузки
        wide.addEventListener('change', (e) => {
            if (e.matches) this._buildStage();
        });
    },

    // Медленно дрейфующие пятна света за игровым экраном (видны в полях по бокам на ПК)
    _buildStage() {
        if (this.stage) return;

        const stage = document.createElement('div');
        stage.className = 'ambient-stage';
        stage.setAttribute('aria-hidden', 'true');
        stage.innerHTML = '<i></i><i></i><i></i>';
        document.body.appendChild(stage);
        this.stage = stage;

        requestAnimationFrame(() => stage.classList.add('ready'));
    },

    /**
     * Следит за видео и перерисовывает его кадры в маленький canvas.
     * CSS размывает этот canvas — получается свечение в цвет ролика,
     * как ambient mode у видео на YouTube.
     *
     * @param {HTMLVideoElement} video
     * @param {string|HTMLCanvasElement} canvasTarget
     * @param {{ interval?: number }} options
     */
    followVideo(video, canvasTarget, options = {}) {
        this.stop();
        if (!video) return;

        const canvas = typeof canvasTarget === 'string'
            ? document.querySelector(canvasTarget)
            : canvasTarget;
        if (!canvas || !canvas.getContext) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.classList.add('is-live');

        const gen = ++this._generation;
        // При «меньше движения» обновляем цвет реже, чтобы не мельтешило
        const interval = this._reduced ? 1600 : Math.max(120, options.interval || 320);

        const draw = () => {
            if (gen !== this._generation) return;

            if (video.readyState >= 2 && video.videoWidth > 0) {
                // Квадратный кроп по центру — как object-fit: cover у кружка
                const size = Math.min(video.videoWidth, video.videoHeight);
                const sx = (video.videoWidth - size) / 2;
                const sy = (video.videoHeight - size) / 2;
                try {
                    ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
                } catch (e) {
                    // Кадр ещё не готов — просто дождёмся следующего
                }
            }

            // В фоновой вкладке не тратим ресурсы на частые перерисовки
            this._timer = setTimeout(draw, document.hidden ? interval * 4 : interval);
        };

        this._active = { video, canvas };
        draw();
    },

    stop() {
        this._generation++;
        if (this._timer) clearTimeout(this._timer);
        this._timer = null;
        if (this._active && this._active.canvas) {
            this._active.canvas.classList.remove('is-live');
        }
        this._active = null;
    }
};

window.addEventListener('DOMContentLoaded', () => Ambient.init());
