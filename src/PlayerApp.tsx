import { useEffect, useState } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { loadSettings } from './utils/settings';

/** Root of the transparent player-controls window (loaded with ?player=1). */
export default function PlayerApp() {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [uiScale, setUiScale] = useState(() => loadSettings().uiScale);

  useEffect(() => {
    const api = window.electronAPI;
    api.playerGetSession().then((s) => { if (s) setSession(s); });
    return api.onPlayerSession(setSession);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'netflix_settings' || e.key === null) {
        setUiScale(loadSettings().uiScale);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!session) return null;
  return (
    <div style={{ zoom: uiScale }}>
      <VideoPlayer key={session.path} session={session} />
    </div>
  );
}
