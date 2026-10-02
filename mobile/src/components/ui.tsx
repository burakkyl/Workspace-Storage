import React, { useEffect } from 'react';
import { initials } from '../lib/format';
import { useApp } from '../store';
import {
  IconCalendar, IconChat, IconCheckSquare, IconCloud, IconClose, IconHome, IconSettings,
} from '../lib/icons';

/* ------------------------------------------------------------------ avatar */
export const Avatar = ({
  name, color = '#2563eb', size, className = '',
}: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) => (
  <div className={`avatar ${size || ''} ${className}`} style={{ background: color }} title={name}>
    {initials(name)}
  </div>
);

export const AvatarStack = ({ people, max = 4 }: { people: { name: string; color: string }[]; max?: number }) => (
  <div className="avatar-stack">
    {people.slice(0, max).map((p, i) => (
      <Avatar key={i} name={p.name} color={p.color} size="sm" />
    ))}
    {people.length > max && <div className="avatar sm" style={{ background: '#94a3b8' }}>+{people.length - max}</div>}
  </div>
);

/* ------------------------------------------------------------------- chip */
export const Chip = ({
  children, tone = '', icon,
}: { children: React.ReactNode; tone?: string; icon?: React.ReactNode }) => (
  <span className={`chip ${tone}`}>
    {icon}
    {children}
  </span>
);

/* ------------------------------------------------------------------ topbar */
export const TopBar = ({
  title, subtitle, onBack, right, plain,
}: {
  title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode; plain?: boolean;
}) => (
  <div className={`topbar ${plain ? 'plain' : ''}`}>
    {onBack && (
      <button className="icon-btn" onClick={onBack} aria-label="Geri">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
    )}
    <div className="grow">
      <h1>{title}</h1>
      {subtitle && <div className="subtitle">{subtitle}</div>}
    </div>
    <div className="topbar-actions">{right}</div>
  </div>
);

/* -------------------------------------------------------------- bottom nav */
const NAV: { tab: any; label: string; icon: React.ReactNode }[] = [
  { tab: 'projects', label: 'Projeler', icon: <IconHome /> },
  { tab: 'storage', label: 'Depolama', icon: <IconCloud /> },
  { tab: 'tasks', label: 'Görevler', icon: <IconCheckSquare /> },
  { tab: 'calendar', label: 'Takvim', icon: <IconCalendar /> },
  { tab: 'chat', label: 'Sohbet', icon: <IconChat /> },
];

export const BottomNav = ({ badgeCount = 0 }: { badgeCount?: number }) => {
  const { activeTab, setTab, openScreen, stack } = useApp();
  const top = stack[stack.length - 1];
  return (
    <nav className="bottom-nav">
      {NAV.map((n) => (
        <button key={n.tab} className={activeTab === n.tab ? 'active' : ''} onClick={() => setTab(n.tab)}>
          <span style={{ position: 'relative', display: 'flex' }}>
            {n.icon}
            {n.tab === 'tasks' && badgeCount > 0 && <span className="badge">{badgeCount > 9 ? '9+' : badgeCount}</span>}
          </span>
          {n.label}
        </button>
      ))}
      <button
        className={top.screen === 'settings' ? 'active' : ''}
        onClick={() => openScreen({ screen: 'settings' })}
        aria-label="Ayarlar"
      >
        <IconSettings />
        Ayarlar
      </button>
    </nav>
  );
};

/* ------------------------------------------------------------------- sheet */
export const Sheet = ({
  title, onClose, children, footer, wide,
}: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" style={wide ? { maxHeight: '94%' } : undefined} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat" style={{ background: 'var(--surface-3)', color: 'var(--ink)' }}>
            <IconClose size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
};

/* -------------------------------------------------------------- durumlar */
export const Spinner = ({ label }: { label?: string }) => (
  <div style={{ textAlign: 'center', padding: '12px 0' }}>
    <div className="spinner" />
    {label && <div className="tiny muted">{label}</div>}
  </div>
);

export const Skeletons = ({ n = 4 }: { n?: number }) => (
  <>
    {Array.from({ length: n }).map((_, i) => (
      <div className="skeleton" key={i} />
    ))}
  </>
);

export const Empty = ({
  icon = '📁', title, text, action,
}: { icon?: string; title: string; text?: string; action?: React.ReactNode }) => (
  <div className="empty">
    <div className="ico">{icon}</div>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {action}
  </div>
);

/* ------------------------------------------------------------- form parcalari */
export const Field = ({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint && <span className="tiny muted">{hint}</span>}
  </div>
);

export const Switch = ({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    className={`switch ${on ? 'on' : ''}`}
    onClick={() => !disabled && onChange(!on)}
    aria-pressed={on}
    aria-label={on ? 'Açık' : 'Kapalı'}
    style={disabled ? { opacity: 0.5 } : undefined}
  />
);

export const Segmented = ({
  items, value, onChange,
}: { items: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) => (
  <div className="segmented">
    {items.map((i) => (
      <button key={i.id} className={value === i.id ? 'active' : ''} onClick={() => onChange(i.id)}>
        {i.label}
        {i.count !== undefined && <span className="muted tiny"> {i.count}</span>}
      </button>
    ))}
  </div>
);

export const Chips = ({
  items, value, onChange,
}: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) => (
  <div className="chips">
    {items.map((i) => (
      <button key={i.id} className={value === i.id ? 'active' : ''} onClick={() => onChange(i.id)}>
        {i.label}
      </button>
    ))}
  </div>
);

export const Bar = ({ pct, tone = '' }: { pct: number; tone?: string }) => (
  <div className={`bar ${tone}`}>
    <span style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
  </div>
);

export const Stat = ({ value, label }: { value: React.ReactNode; label: string }) => (
  <div className="stat">
    <b>{value}</b>
    <span>{label}</span>
  </div>
);

/* ------------------------------------------------------------------ toast */
export const Toasts = () => {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind === 'ok' ? 'ok' : t.kind === 'err' ? 'err' : ''}`} onClick={() => dismissToast(t.id)}>
          <span>{t.kind === 'ok' ? '✓' : t.kind === 'err' ? '!' : 'i'}</span>
          <span className="grow">{t.text}</span>
        </div>
      ))}
    </div>
  );
};
