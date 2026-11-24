const Viewport = {
    GAME_WIDTH: 480,
    GAME_HEIGHT: 854,
    MAX_SCALE_PC: 1.5,
    ASPECT_THRESHOLD: 0.25,

    init() {
        this.update();
        window.addEventListener('resize', () => this.update());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.update(), 150);
        });
    },

    update() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const gameAspect = this.GAME_WIDTH / this.GAME_HEIGHT;
    const screenAspect = vw / vh;
    const aspectDiff = Math.abs(screenAspect - gameAspect) / gameAspect;

    let transform;
    let stretchRatio = 1;   // во сколько раз экран растянут по вертикали относительно горизонтали

    if (aspectDiff < this.ASPECT_THRESHOLD) {
        // ТЕЛЕФОН: растягиваем неравномерно
        const scaleX = vw / this.GAME_WIDTH;
        const scaleY = vh / this.GAME_HEIGHT;
        stretchRatio = scaleY / scaleX;
        transform = `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`;
    } else {
        // ПК: uniform scale
        let scale = Math.min(vw / this.GAME_WIDTH, vh / this.GAME_HEIGHT);
        if (scale > this.MAX_SCALE_PC) scale = this.MAX_SCALE_PC;
        transform = `translate(-50%, -50%) scale(${scale})`;
    }

    // Сохраняем коэффициент растяжения для CSS
    document.documentElement.style.setProperty('--stretch-ratio', stretchRatio);

    document.querySelectorAll('.screen').forEach(el => {
        el.style.transform = transform;
    });
    }
};

window.addEventListener('DOMContentLoaded', () => Viewport.init());