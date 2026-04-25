// BatCheckout Progressive Web App - Service Worker

self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Real Web Push Listener (for Node.js Backend)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Notificação do BatCheckout';
    const options = {
        body: data.body || '',
        icon: data.icon || './assets/logo.png',
        badge: data.badge || './assets/logo.png',
        silent: true, // "silenciosa (sem som obrigatório) a menos que o usuário configure o contrário"
        data: data.data || { url: '/pages/dashboard.html' }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Click Interaction
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
// Message Listener for Broadcast Fallback
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIF') {
        self.registration.showNotification(event.data.title, event.data.options);
    }
});
