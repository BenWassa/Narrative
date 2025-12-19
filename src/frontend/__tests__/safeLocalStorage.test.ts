import safeLocalStorage from '../utils/safeLocalStorage';

describe('safeLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('get/set/remove work in normal conditions', () => {
    safeLocalStorage.set('a', '1');
    expect(safeLocalStorage.get('a')).toBe('1');
    safeLocalStorage.remove('a');
    expect(safeLocalStorage.get('a')).toBeNull();
  });

  it('get returns null when localStorage throws', () => {
    const origGet = localStorage.getItem;
    // @ts-ignore
    localStorage.getItem = () => {
      throw new Error('fail');
    };

    try {
      expect(safeLocalStorage.get('x')).toBeNull();
    } finally {
      localStorage.getItem = origGet;
    }
  });

  it('set/remove do not throw when localStorage throws', () => {
    const origSet = localStorage.setItem;
    const origRemove = localStorage.removeItem;
    // @ts-ignore
    localStorage.setItem = () => {
      throw new Error('fail');
    };
    // @ts-ignore
    localStorage.removeItem = () => {
      throw new Error('fail');
    };

    try {
      expect(() => safeLocalStorage.set('x', '1')).not.toThrow();
      expect(() => safeLocalStorage.remove('x')).not.toThrow();
    } finally {
      localStorage.setItem = origSet;
      localStorage.removeItem = origRemove;
    }
  });
});
