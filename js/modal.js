const Modal = {
    activeModal: null,
    creditsOpen: false,
    creditsTimers: [],
    creditsAnimationHandler: null,
    resetCountdown: null,
    helpOpen: false,
    helpCloseTimer: null,
    helpRendered: false,
    helpItems: [],
    helpIndex: [],
    helpSearchTimer: null,
    helpScrollEl: null,
    helpToTop: null,
    helpToTopTimer: null,
    helpLastScrollAt: 0,
    helpScrollingTop: false,
    helpScrollTopTimer: null,
    helpRenderToken: 0,
    toastEl: null,
    toastTimer: null,
    resetConfirmOpen: false,

    handleShare(btn) {
    // innerHTML, а не textContent: иначе вместе с подписью сотрётся SVG-иконка
    const originalHTML = btn.innerHTML;
    
    // В Telegram Mini App используем нативный API
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.openTelegramLink(
            'https://t.me/share/url?url=' + encodeURIComponent(window.location.href) +
            '&text=' + encodeURIComponent('Зацени игру Amber Fields!')
        );
    } else {
        // Fallback для браузера
        if (navigator.share) {
            navigator.share({
                title: 'Amber Fields',
                text: 'Зацени игру!',
                url: window.location.href
            }).catch(() => {});
        } else {
            // Просто копируем ссылку
            navigator.clipboard.writeText(window.location.href);
            btn.innerHTML = 'ССЫЛКА СКОПИРОВАНА';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        }
    }
    },

    init() {
        // FAQ аккордеон через делегирование: один слушатель вместо 50
        const faqList = document.getElementById('faq-list');
        if (faqList) {
            faqList.addEventListener('click', (e) => {
                const btn = e.target.closest('.faq-question');
                if (!btn) return;

                const item = btn.closest('.faq-item');
                if (!item) return;

                const willOpen = !item.classList.contains('open');
                const openItem = faqList.querySelector('.faq-item.open');

                if (openItem && openItem !== item) {
                    openItem.classList.remove('open');
                    const openBtn = openItem.querySelector('.faq-question');
                    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
                }

                item.classList.toggle('open', willOpen);
                btn.setAttribute('aria-expanded', String(willOpen));
            });
        }

        // Поиск по вопросам: рендер ленивый, ввод с задержкой
        const helpSearch = document.getElementById('help-search');
        const helpSearchWrap = helpSearch ? helpSearch.closest('.help-search') : null;
        const helpSearchClear = helpSearchWrap ? helpSearchWrap.querySelector('.help-search-clear') : null;

        if (helpSearch) {
            helpSearch.addEventListener('input', () => {
                if (helpSearchWrap) {
                    helpSearchWrap.classList.toggle('has-value', helpSearch.value.length > 0);
                }

                if (this.helpSearchTimer) clearTimeout(this.helpSearchTimer);
                this.helpSearchTimer = setTimeout(() => {
                    this.filterHelp(helpSearch.value);
                    this.helpSearchTimer = null;
                }, 120);
            });
        }

        if (helpSearchClear) {
            helpSearchClear.addEventListener('click', () => {
                if (helpSearch) {
                    helpSearch.value = '';
                    helpSearch.focus();
                }
                if (helpSearchWrap) helpSearchWrap.classList.remove('has-value');
                if (this.helpSearchTimer) {
                    clearTimeout(this.helpSearchTimer);
                    this.helpSearchTimer = null;
                }
                this.filterHelp('');
            });
        }

        // Клик по фону — закрыть помощь
        const helpScreen = document.getElementById('help-screen');
        if (helpScreen) {
            helpScreen.addEventListener('click', (e) => {
                if (e.target === helpScreen || e.target.classList.contains('help-backdrop')) {
                    this.closeHelp();
                }
            });
        }

        // Кнопка закрытия Help
        const helpClose = document.querySelector('.help-close');
        if (helpClose) {
            helpClose.addEventListener('click', () => this.closeHelp());
        }

        // Кнопка «Наверх»: показываем только после заметной прокрутки
        const helpScroll = document.querySelector('#help-screen .help-scroll');
        const helpToTop = document.getElementById('help-to-top');
        if (helpScroll && helpToTop) {
            this.helpScrollEl = helpScroll;
            this.helpToTop = helpToTop;

            helpScroll.addEventListener('scroll', () => {
                this.helpLastScrollAt = Date.now();
                if (this.helpToTopTimer) clearTimeout(this.helpToTopTimer);

                // Пока идёт плавный возврат наверх, кнопку не показываем
                if (this.helpScrollingTop) {
                    this.helpToTopTimer = null;
                    this.setHelpToTopVisible(false);
                    return;
                }

                if (helpScroll.scrollTop <= 320) {
                    this.helpToTopTimer = null;
                    this.setHelpToTopVisible(false);
                    return;
                }

                // Пока список двигается, кнопку не показываем и не даём
                // по ней попасть пальцем во время инерционного скролла
                this.helpToTopTimer = setTimeout(() => {
                    this.helpToTopTimer = null;
                    if (helpScroll.scrollTop > 320) this.setHelpToTopVisible(true);
                }, 220);
            }, { passive: true });

            helpToTop.addEventListener('click', () => {
                if (Date.now() - this.helpLastScrollAt < 300) return;
                this.scrollHelpToTop();
            });
        }
        // Клик по оверлею — закрыть именно этот оверлей
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target !== overlay) return;
                if (overlay.id === 'modal-reset-confirm') {
                    this.closeResetConfirm();
                } else if (overlay === this.activeModal) {
                    this.close();
                }
            });
        });

        // Слайдеры (значение рядом + сохранение)
        document.querySelectorAll('.slider').forEach(slider => {
            const valueEl = slider.parentElement.querySelector('.slider-value');
            const update = () => {
                if (valueEl) valueEl.textContent = slider.value;
                // Здесь потом: AudioManager.setVolume(slider.dataset.setting, slider.value / 100)
            };
            slider.addEventListener('input', update);
            update();
        });

        // Тост-уведомление
        this.toastEl = document.getElementById('toast');

        // Toggle-группы (RU/EN, ВКЛ/ВЫКЛ)
        document.querySelectorAll('.toggle-group').forEach(group => {
            const options = group.querySelectorAll('.toggle-option');
            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    // Здесь потом: сохранение в Settings.set(group.dataset.setting, opt.dataset.value)
                    console.log('setting:', group.dataset.setting, '=', opt.dataset.value);
                });
            });
        });

        // Кнопка сброса в настройках — открывает модалку подтверждения
const resetBtn = document.getElementById('btn-reset-progress');
if (resetBtn) {
    resetBtn.addEventListener('click', () => this.openResetConfirm());
}

// Кнопка «Отмена» в модалке подтверждения
const resetCancelBtn = document.getElementById('btn-reset-cancel');
if (resetCancelBtn) {
    resetCancelBtn.addEventListener('click', () => this.closeResetConfirm());
}

// Кнопка «Сбросить» в модалке подтверждения
const resetConfirmBtn = document.getElementById('btn-reset-confirm');
if (resetConfirmBtn) {
    resetConfirmBtn.addEventListener('click', () => {
        if (!resetConfirmBtn.disabled) this.confirmReset();
    });
}
        // Share
        const shareBtn = document.getElementById('btn-share');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.handleShare(shareBtn));
        }
        // Крестик в Credits
        const creditsClose = document.querySelector('.credits-close');
        if (creditsClose) {
            creditsClose.addEventListener('click', () => this.closeCredits());
        }

        // Финальная карточка — возврат только по клику
        const creditsThanks = document.querySelector('.credits-thanks');
        if (creditsThanks) {
            creditsThanks.addEventListener('click', () => {
                if (this.creditsOpen) this.closeCredits();
            });
        }

        // ESC — закрываем верхний слой и останавливаемся
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.creditsOpen) { this.closeCredits(); return; }
            if (this.helpOpen) { this.closeHelp(); return; }
            if (this.resetConfirmOpen) { this.closeResetConfirm(); return; }
            if (this.activeModal) this.close();
        });

    },

    // Рендерим список помощи в простое, чтобы первое открытие было мгновенным.
    // Вызывается при показе главного меню, а не сразу при загрузке страницы.
    scheduleHelpRender() {
        // Токен отменяет отложенный рендер, если игра уже началась
        const token = ++this.helpRenderToken;
        const run = () => {
            if (token === this.helpRenderToken) this.ensureHelpRendered();
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(run, { timeout: 2500 });
        } else {
            setTimeout(run, 900);
        }
    },

    ensureHelpRendered() {
        if (this.helpRendered) return;

        const list = document.getElementById('faq-list');
        if (!list) return;

        const data = (typeof HelpFAQ !== 'undefined' && Array.isArray(HelpFAQ)) ? HelpFAQ : [];
        const fragment = document.createDocumentFragment();

        this.helpItems = [];
        this.helpIndex = [];

        data.forEach((entry, index) => {
            const item = document.createElement('article');
            item.className = 'faq-item';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'faq-question';
            btn.setAttribute('aria-expanded', 'false');

            const num = document.createElement('span');
            num.className = 'faq-index';
            num.textContent = String(index + 1).padStart(2, '0');

            const text = document.createElement('span');
            text.className = 'faq-text';
            text.textContent = entry.q;

            const arrow = document.createElement('span');
            arrow.className = 'faq-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

            btn.append(num, text, arrow);

            const answer = document.createElement('div');
            answer.className = 'faq-answer';

            const inner = document.createElement('div');
            inner.className = 'faq-answer-inner';

            const paragraph = document.createElement('p');
            paragraph.textContent = entry.a;

            inner.appendChild(paragraph);
            answer.appendChild(inner);
            item.append(btn, answer);
            fragment.appendChild(item);

            this.helpItems.push(item);
            this.helpIndex.push((entry.q + ' ' + entry.a).toLowerCase());
        });

        list.replaceChildren(fragment);
        this.helpRendered = true;
        this.updateHelpCount(this.helpItems.length);
    },

    openHelp() {
        ScreenManager.setAmbientTheme('help');
        const screen = document.getElementById('help-screen');
        if (!screen) return;

        this.helpOpen = true;
        if (this.helpCloseTimer) {
            clearTimeout(this.helpCloseTimer);
            this.helpCloseTimer = null;
        }
        this.resetHelpSearch();

        const scroll = screen.querySelector('.help-scroll');
        if (scroll) scroll.scrollTop = 0;
        this.clearHelpToTopTimer();
        this.setHelpToTopVisible(false);
        this.helpScrollingTop = false;
        if (this.helpScrollTopTimer) {
            clearTimeout(this.helpScrollTopTimer);
            this.helpScrollTopTimer = null;
        }

        screen.classList.remove('hidden-element');
        void screen.offsetWidth;
        screen.classList.add('active');
    },

    closeHelp() {
        ScreenManager.setAmbientTheme('menu');
        const screen = document.getElementById('help-screen');
        if (!screen) return;

        screen.classList.remove('active');
        if (this.helpCloseTimer) clearTimeout(this.helpCloseTimer);
        this.helpCloseTimer = setTimeout(() => {
            screen.classList.add('hidden-element');
            this.helpOpen = false;
            this.helpCloseTimer = null;
        }, 260);
    },

    resetHelpSearch() {
        const input = document.getElementById('help-search');
        const wrap = input ? input.closest('.help-search') : null;

        if (input) input.value = '';
        if (wrap) wrap.classList.remove('has-value');
        this.filterHelp('');
    },

    filterHelp(rawQuery) {
        this.ensureHelpRendered();

        const query = String(rawQuery || '').trim().toLowerCase();
        const items = this.helpItems;
        let visible = 0;

        for (let i = 0; i < items.length; i++) {
            const matches = !query || this.helpIndex[i].includes(query);
            const item = items[i];
            item.classList.toggle('is-hidden', !matches);

            if (matches) {
                visible++;
            } else if (item.classList.contains('open')) {
                item.classList.remove('open');
                const btn = item.querySelector('.faq-question');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        }

        const empty = document.getElementById('help-empty');
        if (empty) empty.classList.toggle('hidden-element', visible > 0);

        this.updateHelpCount(visible);
        this.clearHelpToTopTimer();
        this.setHelpToTopVisible(this.helpScrollEl ? this.helpScrollEl.scrollTop > 320 : false);
    },

    setHelpToTopVisible(visible) {
        if (!this.helpToTop) return;

        this.helpToTop.classList.toggle('visible', visible);
        this.helpToTop.setAttribute('aria-hidden', String(!visible));
        this.helpToTop.tabIndex = visible ? 0 : -1;
    },

    clearHelpToTopTimer() {
        if (this.helpToTopTimer) clearTimeout(this.helpToTopTimer);
        this.helpToTopTimer = null;
    },

    scrollHelpToTop() {
        const scroll = this.helpScrollEl;
        if (!scroll) return;

        this.clearHelpToTopTimer();
        this.helpLastScrollAt = 0;
        this.setHelpToTopVisible(false);

        this.helpScrollingTop = true;
        if (this.helpScrollTopTimer) clearTimeout(this.helpScrollTopTimer);
        this.helpScrollTopTimer = setTimeout(() => {
            this.helpScrollingTop = false;
            this.helpScrollTopTimer = null;
        }, 900);

        const reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduceMotion || typeof scroll.scrollTo !== 'function') {
            scroll.scrollTop = 0;
        } else {
            scroll.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    updateHelpCount(visible) {
        const count = document.getElementById('help-count');
        if (!count) return;

        const mod10 = visible % 10;
        const mod100 = visible % 100;
        let word = 'вопросов';

        if (mod10 === 1 && mod100 !== 11) {
            word = 'вопрос';
        } else if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
            word = 'вопроса';
        }

        count.textContent = `${visible} ${word}`;
    },
    // === ТОСТ-УВЕДОМЛЕНИЕ ===
    showToast(text) {
        const el = this.toastEl || document.getElementById('toast');
        if (!el) return;

        this.toastEl = el;
        const textEl = el.querySelector('.toast-text');
        if (textEl) textEl.textContent = text;

        el.setAttribute('aria-hidden', 'false');
        el.classList.add('visible');

        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.toastTimer = null;
            el.classList.remove('visible');
            el.setAttribute('aria-hidden', 'true');
        }, 2600);
    },

    // === СБРОС ПРОГРЕССА ===
    openResetConfirm() {
    const modal = document.getElementById('modal-reset-confirm');
    const confirmBtn = document.getElementById('btn-reset-confirm');
    if (!modal || !confirmBtn) return;

    this.resetConfirmOpen = true;

    // Сброс кнопки в исходное состояние
    confirmBtn.disabled = true;
    let seconds = 5;
    confirmBtn.textContent = `СБРОСИТЬ (${seconds})`;

    // Открываем модалку
    modal.classList.remove('hidden-element', 'closing');
    void modal.offsetWidth;
    modal.classList.add('active');

    // Запускаем обратный отсчёт
    if (this.resetCountdown) clearInterval(this.resetCountdown);
    this.resetCountdown = setInterval(() => {
        seconds--;
        if (seconds > 0) {
            confirmBtn.textContent = `СБРОСИТЬ (${seconds})`;
        } else {
            clearInterval(this.resetCountdown);
            this.resetCountdown = null;
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'СБРОСИТЬ';
        }
    }, 1000);
},

closeResetConfirm() {
    const modal = document.getElementById('modal-reset-confirm');
    this.resetConfirmOpen = false;
    if (!modal) return;
    if (this.resetCountdown) {
        clearInterval(this.resetCountdown);
        this.resetCountdown = null;
    }
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden-element');
    }, 300);
},

confirmReset() {
    // Сбрасываем сохранение — следующий заход снова начнётся с интро
    if (typeof Progress !== 'undefined') {
        Progress.clear();
    } else {
        localStorage.clear();
    }

    // Возвращаем кнопке меню подпись «Играть»
    if (typeof MainMenu !== 'undefined') {
        MainMenu.refreshPlayButton();
    }

    this.closeResetConfirm();
    this.close();  // закрываем и настройки тоже
    this.showToast('ПРОГРЕСС СБРОШЕН');
},

    // === ЗВЁЗДЫ ===
    generateStars() {
        const container = document.querySelector('.credits-stars');
        if (!container || container.children.length > 0) return;

        for (let i = 0; i < 50; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = (Math.random() * 4) + 's';
            star.style.animationDuration = (2 + Math.random() * 3) + 's';
            if (i % 10 === 0) {
                star.style.width = '3px';
                star.style.height = '3px';
                star.style.boxShadow = '0 0 6px rgba(255, 240, 200, 1)';
            }
            container.appendChild(star);
        }
    },

    // === МОДАЛКИ ===
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        this.activeModal = modal;
        modal.classList.remove('hidden-element', 'closing');
        void modal.offsetWidth;
        modal.classList.add('active');
    },

    close() {
        if (!this.activeModal) return;
        const modal = this.activeModal;
        modal.classList.add('closing');
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden-element');
            modal.classList.remove('closing');
            this.activeModal = null;
        }, 300);
    },

    // === CREDITS ===
       openCredits() {
        ScreenManager.setAmbientTheme('credits'); // Меняем фон на темный
        
        const screen = document.getElementById('credits-screen');
        if (!screen) return;

        // Звёзды создаём только при первом открытии титров, а не при загрузке страницы
        this.generateStars();

        const scroll = screen.querySelector('.credits-scroll');
        const thanks = screen.querySelector('.credits-thanks');
        const flyingRaccoon = document.getElementById('flying-raccoon');
        const creditsVideo = document.getElementById('credits-video');

        this.clearCreditsTimers();
        
        // Сброс состояний
        thanks.classList.remove('visible');
        flyingRaccoon.classList.remove('animate');
        flyingRaccoon.classList.add('hidden-element');
        
        // Перезапуск анимации скролла
        scroll.style.animation = 'none';
        void scroll.offsetWidth;
        scroll.style.animation = '';

        this.creditsOpen = true;
        screen.classList.remove('hidden-element');
        void screen.offsetWidth;
        screen.classList.add('active');

        // Когда титры докрутились до конца:
        const onScrollEnd = () => {
            
            // 1. Ждем 2.5 сек и показываем благодарность
            const t1 = setTimeout(() => {
                thanks.classList.add('visible');

                // 2. Еще через 1 сек (чтобы текст успел прочитаться) запускаем енота
                const t2 = setTimeout(() => {
                    const reveal = () => {
                        // Принудительный рефлоу, чтобы анимация началась с нуля
                        void flyingRaccoon.offsetWidth;
                        flyingRaccoon.classList.add('animate');

                        // Свечение вокруг кружка подстраивается под цвет ролика
                        if (typeof Ambient !== 'undefined') Ambient.followVideo(creditsVideo, '#credits-ambient');
                    };

                    // Снимаем display:none сразу: ролик ещё невидим (opacity: 0),
                    // но браузер успевает отрисовать первый кадр
                    flyingRaccoon.classList.remove('hidden-element');

                    if (!creditsVideo) {
                        reveal();
                        return;
                    }

                    // Если ролик уже крутится (повторный вход) — показываем сразу
                    if (!creditsVideo.paused && creditsVideo.readyState >= 2) {
                        reveal();
                        return;
                    }

                    // Ждём первый реальный кадр видео, иначе енот появляется
                    // резко на чёрном кружке, пока грузится ролик
                    let guard = null;
                    const show = () => {
                        creditsVideo.removeEventListener('playing', show);
                        if (guard) clearTimeout(guard);
                        reveal();
                    };
                    creditsVideo.addEventListener('playing', show);
                    creditsVideo.play().catch(() => {});
                    // Страховка, если браузер не запустит видео сам
                    guard = setTimeout(show, 1500);
                    this.creditsTimers.push(guard);
                }, 1000);
                this.creditsTimers.push(t2);

                // Дальше экран не закрывается сам — ждём клика по финальной карточке
            }, 2500);
            this.creditsTimers.push(t1);
        };
        this.creditsAnimationHandler = onScrollEnd;
        scroll.addEventListener('animationend', onScrollEnd, { once: true });
    },

    closeCredits() {
        ScreenManager.setAmbientTheme('menu');
        if (typeof Ambient !== 'undefined') Ambient.stop();
        const screen = document.getElementById('credits-screen');
        if (!screen) return;
        this.clearCreditsTimers();
        screen.classList.remove('active');
        setTimeout(() => {
            screen.classList.add('hidden-element');
            const thanks = screen.querySelector('.credits-thanks');
            if (thanks) thanks.classList.remove('visible');
            this.creditsOpen = false;
        }, 800);
    },

    // === ОСВОБОЖДЕНИЕ ПАМЯТИ ПОСЛЕ СТАРТА ИГРЫ ===
    // FAQ-разметка и звёзды нужны только меню и титрам. В игре не держим их в DOM.
    releaseForGame() {
        this.helpRenderToken++;
        if (this.helpSearchTimer) {
            clearTimeout(this.helpSearchTimer);
            this.helpSearchTimer = null;
        }
        this.clearHelpToTopTimer();
        this.clearCreditsTimers();

        if (this.helpRendered) {
            const list = document.getElementById('faq-list');
            if (list) list.replaceChildren();
            this.helpItems = [];
            this.helpIndex = [];
            this.helpRendered = false;
        }

        document.querySelectorAll('.credits-stars').forEach(box => box.replaceChildren());
    },

    clearCreditsTimers() {
        this.creditsTimers.forEach(t => clearTimeout(t));
        this.creditsTimers = [];

        // Снимаем слушатель, иначе он сработает от следующей анимации
        if (this.creditsAnimationHandler) {
            const scroll = document.querySelector('#credits-screen .credits-scroll');
            if (scroll) scroll.removeEventListener('animationend', this.creditsAnimationHandler);
            this.creditsAnimationHandler = null;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => Modal.init());
