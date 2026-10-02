import React from 'react';
import { TopBar } from '../components/ui';
import CalendarTab from './project/CalendarTab';
import { useApp } from '../store';

/** Tum projeleri kapsayan takvim sekmesi. */
export default function CalendarScreen() {
  const { me } = useApp();
  return (
    <>
      <TopBar title="Takvim" subtitle="Planlama · Outlook · Teams toplantıları" />
      <div className="screen">
        <CalendarTab />
      </div>
    </>
  );
}
