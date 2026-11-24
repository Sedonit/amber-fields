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
        this.initHiddenAdmin();

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

    // Скрытый вход в админку.
    // Секрет: двойной клик по логотипу, затем в настройках переключить язык RU → EN.
    initHiddenAdmin() {
        const logo = document.querySelector('.logo-wrapper');
        const langGroup = document.querySelector('.toggle-group[data-setting="language"]');
        if (!logo || !langGroup) return;

        this._adminUnlockArmed = false;

        // Первый шаг — двойной клик по логотипу
        logo.addEventListener('dblclick', () => {
            this._adminUnlockArmed = true;
        });

        // Слушаем группу в фазе перехвата, чтобы увидеть состояние ДО клика
        // (к этому моменту RU ещё активен, переключение в EN только предстоит).
        langGroup.addEventListener('click', (event) => {
            if (!this._adminUnlockArmed) return;

            const option = event.target.closest('.toggle-option');
            if (!option || option.dataset.value !== 'en') return;

            const settings = document.getElementById('modal-settings');
            const settingsOpen = settings && settings.classList.contains('active');
            if (!settingsOpen) return;

            const ruOption = langGroup.querySelector('.toggle-option[data-value="ru"]');
            if (!ruOption || !ruOption.classList.contains('active')) return;

            this._adminUnlockArmed = false;
            this.revealAdminGate();
        }, true);
    },

    // Прячем настройки и показываем форму входа админки
    revealAdminGate() {
        if (typeof Modal !== 'undefined' && typeof Modal.close === 'function') {
            Modal.close();
        }

        setTimeout(() => {
            if (typeof Admin === 'undefined') return;
            if (typeof Admin.openGate === 'function') {
                Admin.openGate();
            } else {
                Admin.open();
            }
        }, 300);
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
