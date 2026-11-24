const MainMenu = {
    soundOn: true,

    init() {
        const btnPlay = document.getElementById('btn-play');
        const btnSettings = document.getElementById('btn-settings');
        const btnCredits = document.getElementById('btn-credits');
        const btnHelp = document.getElementById('btn-help');
        const btnSound = document.getElementById('btn-sound');
        const btnReload = document.getElementById('btn-reload-after-start');

        this.refreshPlayButton();

        if (btnPlay) {
            btnPlay.addEventListener('click', () => {
                // Игра уже начата — продолжаем с сохранения, без интро
                if (Progress.hasStarted()) {
                    this.continueGame();
                    return;
                }

                // Защита от повторного клика, пока интро грузится
                if (btnPlay.disabled) return;

                // Новый игрок (или прогресс сброшен) — подгружаем бандл интро
                const originalText = btnPlay.textContent;
                btnPlay.disabled = true;
                btnPlay.textContent = 'ЗАГРУЗКА...';

                const startIntro = () => {
                    btnPlay.disabled = false;
                    btnPlay.textContent = originalText;
                    ScreenManager.showScreen('intro-screen');
                    Intro.init();
                };

                const failIntro = () => {
                    btnPlay.disabled = false;
                    btnPlay.textContent = originalText;
                    if (typeof Modal !== 'undefined' && typeof Modal.showToast === 'function') {
                        Modal.showToast('ОШИБКА ЗАГРУЗКИ ИНТРО');
                    } else {
                        console.warn('Ошибка загрузки интро');
                    }
                };

                if (typeof AssetManager === 'undefined') {
                    startIntro();
                    return;
                }

                AssetManager.loadBundle('intro').then(startIntro).catch(failIntro);
            });
        }

        if (btnReload) {
            btnReload.addEventListener('click', () => window.location.reload());
        }

        if (btnSettings) {
        btnSettings.addEventListener('click', () => Modal.open('modal-settings'));
        }


        if (btnCredits) {
        btnCredits.addEventListener('click', () => Modal.openCredits());
        }

        if (btnHelp) {
    btnHelp.addEventListener('click', () => Modal.openHelp());
}

        if (btnSound) {
            const soundLabel = document.getElementById('sound-label');

            const renderSound = () => {
                btnSound.dataset.state = this.soundOn ? 'on' : 'off';
                btnSound.setAttribute('aria-pressed', String(this.soundOn));
                if (soundLabel) soundLabel.textContent = this.soundOn ? 'ON' : 'OFF';
            };

            btnSound.addEventListener('click', () => {
                this.soundOn = !this.soundOn;
                renderSound();
                // Позже тут будет AudioManager.toggleMute()
            });

            renderSound();
        }
    },

    // Подпись главной кнопки зависит от наличия сохранения.
    // Вызывается при старте и после сброса прогресса.
    refreshPlayButton() {
        const btnPlay = document.getElementById('btn-play');
        if (!btnPlay) return;

        const hasSave = Progress.hasStarted();
        btnPlay.textContent = hasSave ? 'Продолжить' : 'Играть';
        btnPlay.dataset.mode = hasSave ? 'continue' : 'new';
        btnPlay.setAttribute('aria-label', hasSave ? 'Продолжить игру' : 'Начать новую игру');
    },

    continueGame() {
        ScreenManager.showScreen('game-screen');
        if (typeof Modal !== 'undefined' && typeof Modal.showToast === 'function') {
            Modal.showToast('ПРОГРЕСС ЗАГРУЖЕН');
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    MainMenu.init();
});
