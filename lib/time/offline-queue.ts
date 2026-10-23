const DB = "rehabinco-fichajes";
const STORE = "pending-punches";

export type PendingPunch = {
  clientId: string;
  type: string;
  mode: string;
  workCenterId?: string | null;
  clientAt: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  source: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function encolarPunch(p: PendingPunch): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listarPendientes(): Promise<PendingPunch[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const rows = await new Promise<PendingPunch[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PendingPunch[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

export async function borrarPendiente(clientId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function sincronizarPendientes(): Promise<number> {
  const pending = await listarPendientes();
  let ok = 0;
  for (const p of pending) {
    try {
      const res = await fetch("/api/time/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const json = await res.json();
      if (json.ok) {
        await borrarPendiente(p.clientId);
        ok += 1;
      }
    } catch {
      break;
    }
  }
  return ok;
}
