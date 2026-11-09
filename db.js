/* Stockage local des projets (IndexedDB) — les photos peuvent être volumineuses,
   IndexedDB est donc préféré à localStorage. */
const DB = (() => {
  const NAME = 'pv-business-plan';
  const STORE = 'projects';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const req = fn(store);
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  return {
    all: () => tx('readonly', s => s.getAll()),
    put: (project) => tx('readwrite', s => s.put(project)),
    remove: (id) => tx('readwrite', s => s.delete(id)),
  };
})();
