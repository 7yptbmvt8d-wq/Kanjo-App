/* eslint-disable no-undef */
// Service worker des notifications push de FOND (app fermée / en arrière-plan).
//
// ⚠️ Fichier statique : il NE PEUT PAS lire les variables d'env Vite. La
// config Firebase doit donc être écrite EN DUR ci-dessous. Ces valeurs ne
// sont pas secrètes (elles partent déjà dans le bundle client), mais si
// vous les oubliez, les push de fond ne marcheront pas.
//
// → Console Firebase → Project settings → Your apps → Web (</>).
// Remplacez les TODO par les valeurs de VOTRE projet.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDxVHxSqUNi2xdsFroVL1qON5a1RQVkq8s",
  authDomain: "kanjo-aikido.firebaseapp.com",
  projectId: "kanjo-aikido",
  storageBucket: "kanjo-aikido.firebasestorage.app",
  messagingSenderId: "319041643134",
  appId: "1:319041643134:web:a7b6a5ef7629df953e2e2f",
});

const messaging = firebase.messaging();

// Notification quand l'app est en arrière-plan / fermée. (Au premier plan,
// c'est usePush() qui affiche un toast in-app — voir src/hooks/usePush.js.)
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || payload.notification || {};
  const title = d.title || "Kanjo Aïkido";
  const options = {
    body: d.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-64x64.png",
    data: { url: "/" },
  };
  self.registration.showNotification(title, options);
});

// Tap sur la notif → ouvre / refocalise l'app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});
