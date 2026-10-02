import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, authApi, initApi, saveToken } from './lib/api';
import { clearWebCallback, exchangeMicrosoftCode, webCallbackCode } from './lib/msOAuth';

export type Tab = 'projects' | 'storage' | 'tasks' | 'calendar' | 'chat';
export type Route =
  | { screen: Tab }
  | { screen: 'project'; id: string; tab?: string }
  | { screen: 'settings' }
  | { screen: 'admin' };

type Me = {
  user: any;
  projects: any[];
  connections: any[];
};

type Toast = { id: number; text: string; kind: 'ok' | 'err' | 'info' };

type Ctx = {
  booting: boolean;
  me: Me | null;
  projects: any[];
  stack: Route[];
  activeTab: Tab;
  setTab: (t: Tab) => void;
  openProject: (id: string, tab?: string) => void;
  openScreen: (r: Route) => void;
  back: () => void;
  replaceAll: (r: Route) => void;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  toasts: Toast[];
  notify: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
};

const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

const TABS: Tab[] = ['projects', 'storage', 'tasks', 'calendar', 'chat'];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [stack, setStack] = useState<Route[]>([{ screen: 'projects' }]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const notify = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    try {
      const [meData, projectList] = await Promise.all([authApi.me(), api.get('/projects')]);
      setMe(meData);
      setProjects(projectList);
    } catch (e: any) {
      if (e?.status === 401) {
        setMe(null);
        await saveToken(null);
      } else {
        notify(e?.message || 'Veriler yüklenemedi', 'err');
      }
    }
  }, [notify]);

  useEffect(() => {
    (async () => {
      const { token } = await initApi();
      // Web'de Microsoft geri donusu: ?code=... ile geldiyse oturumu tamamla
      const code = webCallbackCode();
      if (code) {
        try {
          await exchangeMicrosoftCode(code);
          clearWebCallback();
          await refresh();
        } catch {
          clearWebCallback();
        }
      } else if (token) {
        await refresh();
      }
      setBooting(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (userId: string) => {
      const res = await authApi.login(userId);
      await saveToken(res.token);
      setStack([{ screen: 'projects' }]);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* oturum zaten dusmus olabilir */
    }
    await saveToken(null);
    setMe(null);
    setProjects([]);
    setStack([{ screen: 'projects' }]);
  }, []);

  const setTab = useCallback((t: Tab) => setStack([{ screen: t }]), []);
  const openProject = useCallback((id: string, tab?: string) => setStack((s) => [...s, { screen: 'project', id, tab }]), []);
  const openScreen = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const back = useCallback(
    () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ screen: 'projects' as Tab }])),
    [],
  );
  const replaceAll = useCallback((r: Route) => setStack([r]), []);

  const top = stack[stack.length - 1];
  const activeTab: Tab = useMemo(() => {
    if (TABS.includes(top.screen as Tab)) return top.screen as Tab;
    if (top.screen === 'project') {
      const pj = (top as any).tab;
      if (pj === 'storage') return 'storage';
      if (pj === 'tasks') return 'tasks';
      if (pj === 'calendar') return 'calendar';
      if (pj === 'chat') return 'chat';
    }
    return 'projects';
  }, [top]);

  const value: Ctx = {
    booting, me, projects, stack, activeTab,
    setTab, openProject, openScreen, back, replaceAll,
    login, logout, refresh, toasts, notify, dismissToast,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
