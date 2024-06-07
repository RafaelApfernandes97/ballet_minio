self.addEventListener('push', function(event) {
  const data = event.data.json();
  const title = data.title || 'Notificação';
  const options = {
    body: data.body || 'Mensagem padrão',  // Adiciona um fallback para o corpo da mensagem
    icon: '/static/img/logo.png',
    badge: '/static/img/logo.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || 'https://fotos.oballetemfoco.com')
  );
});
