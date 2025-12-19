export default {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('safeLocalStorage.get failed', err);
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('safeLocalStorage.set failed', err);
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('safeLocalStorage.remove failed', err);
    }
  },
};
