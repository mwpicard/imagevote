const CACHE_NAME = "imagevote-v1";
const OFFLINE_QUEUE_STORE = "offline-queue";

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // POST requests: try network, queue if offline
  if (request.method === "POST") {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Queue the POST for later sync
        const body = await request.clone().arrayBuffer();
        const queueEntry = {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body: Array.from(new Uint8Array(body)),
          timestamp: Date.now(),
        };
        await saveToQueue(queueEntry);
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Cache-first for uploaded images (they never change)
  if (url.pathname === "/api/uploads") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("Offline", { status: 503 }));
      })
    );
    return;
  }

  // Network-first with cache fallback for API GETs
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 })))
    );
    return;
  }

  // Stale-while-revalidate for pages, JS, CSS
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// IndexedDB helpers for offline queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("imagevote-sw", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OFFLINE_QUEUE_STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToQueue(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Background sync: flush queued POSTs when back online
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-queue") {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  for (const entry of queue) {
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: new Uint8Array(entry.body).buffer,
      });
    } catch {
      // If any request fails, stop and retry later
      return;
    }
  }
  await clearQueue();
  // Notify all clients that sync is complete
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "sync-complete" });
  }
}

// Also try flushing when receiving a message from the client
self.addEventListener("message", (event) => {
  if (event.data === "flush-queue") {
    flushQueue();
  }
});
