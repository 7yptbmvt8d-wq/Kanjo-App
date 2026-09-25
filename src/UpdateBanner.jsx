import { useRegisterSW } from "virtual:pwa-register/react";

// Bandeau « nouvelle version disponible ». Avec registerType "prompt", le
// service worker télécharge la nouvelle version en fond mais ne l'active
// qu'à la demande : on affiche ce bandeau et l'adhérent recharge en un tap,
// sans avoir à fermer/rouvrir l'app.
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Vérifie périodiquement l'existence d'une nouvelle version (toutes
      // les heures) pour que le bandeau apparaisse sans redémarrage.
      if (registration) {
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      className="fixed inset-x-0 z-[60] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
    >
      <div className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-[16px] bg-night text-cream border border-gold/40 shadow-device px-4 py-3 animate-slide-up">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[14px] font-semibold text-gold leading-tight">
            Nouvelle version disponible
          </div>
          <div className="text-[12px] text-cream/75 leading-snug mt-0.5">
            Appuie pour charger les dernières améliorations.
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 text-[12.5px] font-semibold text-night bg-gold rounded-full px-4 py-2 shadow-card active:scale-[0.98] transition-transform"
        >
          Mettre à jour
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Plus tard"
          className="shrink-0 text-cream/50 text-[18px] leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
