import { useEffect } from 'react';
import { supabase } from './supabase';
import { useStore } from './store';
import type { Announcement } from './types';

export function useAnnouncements() {
  const { announcements, setAnnouncements, upsertAnnouncement, removeAnnouncement } = useStore();

  useEffect(() => {
    supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setAnnouncements(data); });

    const ch = supabase
      .channel('announcements-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
        if (payload.eventType === 'DELETE') removeAnnouncement((payload.old as { id: string }).id);
        else upsertAnnouncement(payload.new as Announcement);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  return announcements;
}
