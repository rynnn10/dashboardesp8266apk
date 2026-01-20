const CACHE_NAME = "iot-smart-v15.7-fix"; // Versi dinaikkan

const urlsToCache = [
  "./",
  "/index.html",
  "/logic.js",
  "/style.css",
  "/manifest.json",
  "/logoapk.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        urlsToCache.map((url) => {
          return cache
            .add(url)
            .catch((err) => console.log("Gagal cache:", url));
        }),
      );
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Hanya proses request GET http/https
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // 1. Coba ambil dari network
        const networkResponse = await fetch(event.request);

        // Simpan ke cache jika valid
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      } catch (error) {
        // 2. Jika offline/gagal, cari di cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 3. Jika tidak ada di cache juga, berikan respon darurat (MENCEGAH ERROR TYPE)
        return new Response("Offline & Data tidak tersedia.", {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "Content-Type": "text/plain" }),
        });
      }
    })(),
  );
});
