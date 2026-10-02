import React, { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../../lib/api';
import { useApp } from '../../store';
import { Avatar, Chip, Chips, Empty, Field, Sheet, Spinner } from '../../components/ui';
import { relative } from '../../lib/format';
import { IconChat, IconPlus, IconSend } from '../../lib/icons';

export default function ChatTab({ project }: { project: any }) {
  const { notify, me } = useApp();
  const [data, setData] = useState<any>(null);
  const [channelId, setChannelId] = useState<string>('');
  const [thread, setThread] = useState<any>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await chatApi.channels(project.id);
      setData(res);
      setChannelId((prev) => prev || res.channels?.[0]?.id || '');
    } catch (e: any) {
      notify(e?.message || 'Kanallar yüklenemedi', 'err');
      setData({ channels: [], can_send: false });
    }
  }, [project.id, notify]);

  const loadThread = useCallback(async () => {
    if (!channelId) return;
    try {
      setThread(await chatApi.messages(channelId));
    } catch (e: any) {
      notify(e?.message || 'Mesajlar yüklenemedi', 'err');
    }
  }, [channelId, notify]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // canli akis: 8 saniyede bir yeni mesajlari getir
  useEffect(() => {
    if (!channelId) return undefined;
    const t = setInterval(loadThread, 8000);
    return () => clearInterval(t);
  }, [channelId, loadThread]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [thread?.messages?.length, channelId]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await chatApi.send(channelId, text.trim());
      setText('');
      await loadThread();
      await loadChannels();
    } catch (e: any) {
      notify(e?.message || 'Mesaj gönderilemedi', 'err');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner label="Kanallar yükleniyor…" />;

  const channels: any[] = data.channels || [];
  const messages: any[] = thread?.messages || [];
  const canSend = thread?.can_send ?? data.can_send;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <div className="grow">
          <Chips
            items={channels.map((c) => ({ id: c.id, label: `#${c.name}` }))}
            value={channelId}
            onChange={setChannelId}
          />
        </div>
        {project.permissions?.can_manage_members && (
          <button className="icon-btn" style={{ background: 'var(--surface-3)', color: 'var(--ink)' }} onClick={() => setCreating(true)} aria-label="Yeni kanal">
            <IconPlus size={17} />
          </button>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="card">
          <Empty icon="💬" title="Kanal yok" text="Proje yöneticisi bir kanal açtığında mesajlaşma burada başlar." />
        </div>
      ) : (
        <div
          className="card"
          ref={scroller}
          style={{ maxHeight: 'calc(100vh - 330px)', minHeight: 260, overflowY: 'auto', paddingBottom: 8 }}
        >
          <div className="row between" style={{ marginBottom: 10 }}>
            <div>
              <div className="strong small">#{channels.find((c) => c.id === channelId)?.name}</div>
              <div className="tiny muted">{channels.find((c) => c.id === channelId)?.topic || 'Proje kanalı'}</div>
            </div>
            <Chip tone="outline">{messages.length} mesaj</Chip>
          </div>

          {messages.length === 0 ? (
            <Empty icon="✍️" title="Henüz mesaj yok" text="İlk mesajı siz yazın." />
          ) : (
            <div className="chat-scroll">
              {messages.map((m: any, i: number) => {
                const mine = m.user_id === me?.user?.id;
                const prev = messages[i - 1];
                const showHead = !prev || prev.user_id !== m.user_id;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
                    {showHead && (
                      <div className="row" style={{ gap: 6, paddingLeft: mine ? 0 : 4, paddingRight: mine ? 4 : 0 }}>
                        {!mine && <Avatar name={m.user_name || '?'} color={m.user_color} size="sm" />}
                        <span className="tiny muted">{mine ? 'Siz' : m.user_name} · {relative(m.created_at)}</span>
                      </div>
                    )}
                    <div className={`bubble ${mine ? 'mine' : ''}`}>{m.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canSend ? (
        <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <textarea
            className="input"
            style={{ borderRadius: 20, minHeight: 42, maxHeight: 110, padding: '10px 14px', resize: 'none' }}
            placeholder={`#${channels.find((c) => c.id === channelId)?.name || 'kanal'} kanalına yaz…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <button className="send-btn" onClick={send} disabled={busy || !text.trim()} aria-label="Gönder">
            <IconSend size={18} />
          </button>
        </div>
      ) : (
        <div className="note warn">
          <IconChat size={15} />
          <span>Bu projede mesaj gönderme yetkiniz yok (İzleyici rolü). Proje yöneticiniz yetkinizi yükseltebilir.</span>
        </div>
      )}

      {creating && (
        <CreateChannelSheet
          project={project}
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await loadChannels();
            notify('Kanal açıldı', 'ok');
          }}
        />
      )}
    </div>
  );
}

function CreateChannelSheet({ project, onClose, onDone }: { project: any; onClose: () => void; onDone: () => void }) {
  const { notify } = useApp();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return notify('Kanal adı zorunlu', 'err');
    setBusy(true);
    try {
      await chatApi.createChannel(project.id, { name: name.trim(), topic });
      onDone();
    } catch (e: any) {
      notify(e?.message || 'Kanal açılamadı', 'err');
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Yeni kanal"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Vazgeç</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Açılıyor…' : 'Kanalı aç'}</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Kanal adı" hint="Örn. saha, duyurular, tedarik">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="kanal-adı" />
        </Field>
        <Field label="Konu">
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Bu kanal ne için?" />
        </Field>
        <div className="note">
          <IconChat size={15} />
          <span>Canlı modda kanal, Microsoft Teams sohbeti olarak da oluşturulur ve mesajlar Teams’e aynalanır.</span>
        </div>
      </div>
    </Sheet>
  );
}
