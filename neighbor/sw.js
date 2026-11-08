// Show-Me Neighbors app: shows visit-offer alerts. It keeps nothing offline, so the app is always the latest version.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Show-Me Neighbors', {
    body: d.body || 'You have a new visit offer.',
    icon: '/neighbor/icon-192.png',
    badge: '/neighbor/icon-192.png',
    tag: d.tag || 'smn',
    renotify: true,
    data: { url: d.url || '/neighbor/' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/neighbor/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('/neighbor/') >= 0 && 'focus' in list[i]) { list[i].postMessage('refresh'); return list[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
