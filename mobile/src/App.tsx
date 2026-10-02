import React from 'react';
import { AppProvider, useApp } from './store';
import { BottomNav, Toasts } from './components/ui';
import { IconCloudLink } from './lib/icons';
import Login from './screens/Login';
import Projects from './screens/Projects';
import Storage from './screens/Storage';
import Tasks from './screens/Tasks';
import CalendarScreen from './screens/CalendarScreen';
import Chat from './screens/Chat';
import Project from './screens/Project';
import Settings from './screens/Settings';
import Admin from './screens/Admin';

function Boot() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'linear-gradient(150deg,#0f172a 0%,#1e3a8a 60%,#2563eb 100%)',
        color: '#fff',
      }}
    >
      <div className="logo-mark" style={{ margin: 0 }}>
        <IconCloudLink size={30} color="#fff" />
      </div>
      <div className="strong" style={{ fontSize: 18, letterSpacing: -0.3 }}>Workspace Storage</div>
      <div className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} />
    </div>
  );
}

function Router() {
  const { booting, me, stack } = useApp();
  if (booting) return <Boot />;
  if (!me) return <Login />;

  const top = stack[stack.length - 1];
  switch (top.screen) {
    case 'storage':
      return <Storage />;
    case 'tasks':
      return <Tasks />;
    case 'calendar':
      return <CalendarScreen />;
    case 'chat':
      return <Chat />;
    case 'project':
      return <Project id={(top as any).id} initialTab={(top as any).tab} />;
    case 'settings':
      return <Settings />;
    case 'admin':
      return <Admin />;
    case 'projects':
    default:
      return <Projects />;
  }
}

function Shell() {
  const { booting, me } = useApp();
  const showNav = !booting && Boolean(me);
  return (
    <div className="device">
      <Router />
      {showNav && <BottomNav />}
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
