// === ПРОГРЕСС ИГРЫ ===
// Пока реальной игры нет, прогрессом считается пройденное интро.
// Флаг хранится в localStorage и переживает перезагрузку страницы.
const Progress = {
    KEY: 'amberfields_save',

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return data && typeof data === 'object' ? data : null;
        } catch (e) {
            return null;
        }
    },

    save(data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage может быть недоступен (приватный режим) — не ломаем игру
        }
    },

    hasStarted() {
        const data = this.load();
        return !!(data && data.started);
    },

    // Игрок начал игру: запоминаем это для следующего захода
    start() {
        const data = this.load() || {};
        data.started = true;
        data.startedAt = data.startedAt || Date.now();
        data.lastPlayed = Date.now();
        this.save(data);
    },

    clear() {
        try {
            localStorage.removeItem(this.KEY);
        } catch (e) {
            // см. save()
        }
    }
};
