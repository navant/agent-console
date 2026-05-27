import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import StudioHome from './StudioHome';
import CoderWorkspace from './CoderWorkspace';

export default function AppShell() {
  const appScreen = useStore(s => s.appScreen);
  const theme = useStore(s => s.theme);
  const accent = useStore(s => s.accent);
  const density = useStore(s => s.density);
  const ascend = useStore(s => s.ascend);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.ascend = ascend ? 'true' : 'false';
  }, [ascend]);

  return (
    <div className={`app-root ${theme} density-${density}`} style={{ '--accent': accent } as React.CSSProperties}>
      {appScreen === 'studio' ? <StudioHome /> : <CoderWorkspace />}
    </div>
  );
}
