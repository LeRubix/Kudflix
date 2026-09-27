import { useEffect, useState } from 'react';
import { VideoPlayer } from './components/VideoPlayer';

/** Root of the transparent player-controls window (loaded with ?player=1). */
export default function PlayerApp() {
  const [session, setSession] = useState<PlayerSession | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    api.playerGetSession().then((s) => { if (s) setSession(s); });
    return api.onPlayerSession(setSession);
  }, []);

  if (!session) return null;
  return <VideoPlayer key={session.path} session={session} />;
}
