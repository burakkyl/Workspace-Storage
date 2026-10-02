import React, { useCallback, useEffect, useState } from 'react';
import { chatApi } from '../lib/api';
import { useApp } from '../store';
import { Chip, Empty, Skeletons, TopBar } from '../components/ui';
import { relative } from '../lib/format';
import { IconChat, IconChevron, IconTeams } from '../lib/icons';

/** Sohbet sekmesi: proje kanallarina hizli erisim. */
export default function Chat() {
  const { projects, openProject, notify } = useApp();
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const out: Record<string, any> = {};
    await Promise.all(
      projects.map(async (p: any) => {
        try {
          const res = await chatApi.channels(p.id);
          const channels = res.channels || [];
          out[p.id] = {
            channels,
            last: channels
              .map((c: any) => ({ c, at: c.last_message_at }))
              .filter((x: any) => x.at)
              .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))[0],
            total: channels.reduce((s: number, c: any) => s + (c.message_count || 0), 0),
          };
        } catch {
          out[p.id] = { channels: [], total: 0 };
        }
      }),
    );
    setPreviews(out);
    setLoading(false);
  }, [projects]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <TopBar title="Sohbet" subtitle="Proje kanalları · Teams ile senkron" />
      <div className="screen">
        {loading ? (
          <Skeletons n={4} />
        ) : projects.length === 0 ? (
          <Empty icon="💬" title="Proje yok" text="Bir projeye eklendiğinizde kanalları burada görünür." />
        ) : (
          projects.map((p: any) => {
            const info = previews[p.id] || { channels: [], total: 0 };
            return (
              <div className="card press" key={p.id} onClick={() => openProject(p.id, 'chat')} style={{ borderLeft: `4px solid ${p.color}` }}>
                <div className="row">
                  <div className="tile-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                    <IconChat size={20} />
                  </div>
                  <div className="grow">
                    <div className="strong ellipsis" style={{ fontSize: 14.5 }}>{p.name}</div>
                    <div className="tiny muted ellipsis">
                      {info.channels.length} kanal · {info.total} mesaj
                      {info.last?.at ? ` · son mesaj ${relative(info.last.at)}` : ''}
                    </div>
                    <div className="row wrap" style={{ gap: 5, marginTop: 7 }}>
                      {info.channels.slice(0, 4).map((c: any) => (
                        <Chip key={c.id} tone="outline">#{c.name}</Chip>
                      ))}
                    </div>
                  </div>
                  <IconChevron size={17} color="var(--ink-3)" />
                </div>
              </div>
            );
          })
        )}

        <div className="note" style={{ marginTop: 14 }}>
          <IconTeams size={16} />
          <span>
            Canlı modda açılan her kanal bir Microsoft Teams sohbetine bağlanır; buradaki mesajlar Teams’e, Teams’teki mesajlar
            buraya yansır.
          </span>
        </div>
      </div>
    </>
  );
}
