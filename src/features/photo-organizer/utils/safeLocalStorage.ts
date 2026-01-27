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
      // Verify the value was actually set
      const stored = localStorage.getItem(key);
      if (stored !== value) {
        throw new Error('Failed to verify localStorage write');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('safeLocalStorage.set failed', err);
      throw err; // Re-throw so callers can handle it
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
