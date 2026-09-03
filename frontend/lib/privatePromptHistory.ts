const DATABASE_NAME = "local-llm-marketplace-private";
const STORE_NAME = "prompt-history";
const DATABASE_VERSION = 1;
const HISTORY_LIMIT = 100;

export type PrivatePromptStatus = "running" | "completed" | "failed" | "interrupted";

export interface PrivatePromptRecord {
  id: string;
  requestId: string | null;
  prompt: string;
  supplierId?: string;
  supplierName?: string;
  status: PrivatePromptStatus;
  startedAt: number;
  finishedAt?: number;
  latencyMs?: number;
  error?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open private prompt history."));
  });
}

export async function listPrivatePrompts(): Promise<PrivatePromptRecord[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const records = (request.result as PrivatePromptRecord[])
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, HISTORY_LIMIT);
        resolve(records);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not read private prompt history."));
    });
  } finally {
    database.close();
  }
}

export async function savePrivatePrompt(record: PrivatePromptRecord): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save private prompt history."));
    });
  } finally {
    database.close();
  }

  const records = await listPrivatePrompts();
  if (records.length < HISTORY_LIMIT) return;

  const databaseForTrim = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = databaseForTrim.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const overflow = (request.result as PrivatePromptRecord[])
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(HISTORY_LIMIT);
        overflow.forEach((item) => store.delete(item.id));
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not trim private prompt history."));
    });
  } finally {
    databaseForTrim.close();
  }
}

export async function clearPrivatePrompts(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not clear private prompt history."));
    });
  } finally {
    database.close();
  }
}
