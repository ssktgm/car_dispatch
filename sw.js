// sw.js

// キャッシュの名前
const CACHE_NAME = 'car-app-cache-v1';

// キャッシュするファイルのリスト
// manifest.json, db.js, icons もキャッシュ対象に追加
const urlsToCache = [
    './', // index.html
    './index.html',
    './master.html',
    './manual.html',
    './db.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    'https://cdn.tailwindcss.com/' // Tailwind CSS
];

// 1. インストールイベント
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    // waitUntil: インストール処理が完了するまで待機
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching app shell');
                // 必要なファイルをキャッシュに追加
                return cache.addAll(urlsToCache);
            })
            .catch((err) => {
                console.error('[ServiceWorker] Cache addAll failed:', err);
            })
    );
});

// 2. アクティベートイベント (古いキャッシュの削除)
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // このSWのバージョンと異なるキャッシュは削除
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // すぐにSWを有効化
    return self.clients.claim();
});

// 3. フェッチイベント (リクエストへの応答)
self.addEventListener('fetch', (event) => {
    // console.log('[ServiceWorker] Fetch:', event.request.url);
    
    // APIリクエストや外部ドメインのリクエストはキャッシュしない (Tailwindを除く)
    if (!event.request.url.startsWith(self.location.origin) &&
        !event.request.url.startsWith('https://cdn.tailwindcss.com')) {
        // console.log('[ServiceWorker] Ignoring non-origin request:', event.request.url);
        return;
    }

    // "Network first, falling back to cache" 戦略
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // ネットワークから取得成功
                
                // レスポンスが有効かチェック
                if (!response || response.status !== 200 || response.type !== 'basic') {
                     // tailwindcss の場合は 'opaque' も許可
                     if (event.request.url.startsWith('https://cdn.tailwindcss.com') && response.type === 'opaque') {
                         // Opaqueレスポンスでもキャッシュに入れる
                     } else {
                        return response;
                     }
                }
                
                // console.log('[ServiceWorker] Fetched from network:', event.request.url);

                // レスポンスを複製（レスポンスは一度しか消費できないため）
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        // console.log('[ServiceWorker] Caching new response:', event.request.url);
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch((err) => {
                // ネットワークから取得失敗 (オフライン)
                console.log('[ServiceWorker] Network request failed. Trying cache:', err.message);
                
                // キャッシュから一致するものを探す
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            console.log('[ServiceWorker] Found in cache:', event.request.url);
                            return cachedResponse;
                        }
                        
                        // キャッシュにもない場合
                        console.log('[ServiceWorker] Not found in cache:', event.request.url);
                        // (ここではフォールバックページは返さず、ブラウザのオフラインエラーをそのまま表示させる)
                        return undefined; 
                    });
            })
    );
});

