'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BedDouble, Plus } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/overlay';
import { useCatalogLabels } from '@/lib/useLabels';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';
import { RoomTypeCard } from './RoomTypeCard';

export function RoomsStep() {
  const t = useTranslations('wizard.rooms');
  const tCommon = useTranslations('common');
  const labels = useCatalogLabels();
  const { draft, addRoom, removeRoom, errorsFor } = useWizard();

  const [openId, setOpenId] = useState<string | null>(draft.roomTypes[0]?.id ?? null);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);

  const listError = labels.validation(errorsFor('rooms')['roomTypes']);

  const add = () => {
    const id = addRoom();
    setNewIds((current) => new Set(current).add(id));
    setOpenId(id);
    // Let the accordion mount before scrolling to it.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-room-id="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  };

  return (
    <>
      <PanelIntro title={t('title')} subtitle={t('subtitle')} />

      {listError ? (
        <p className="rounded-[var(--radius-ctl)] border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
          {listError}
        </p>
      ) : null}

      {draft.roomTypes.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="size-5" />}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Button variant="primary" onClick={add}>
              <Plus className="size-4" />
              {t('addRoomType')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {draft.roomTypes.map((room, index) => (
              <div key={room.id} data-room-id={room.id}>
                <RoomTypeCard
                  room={room}
                  index={index}
                  open={openId === room.id}
                  isNew={newIds.has(room.id)}
                  onToggle={() => setOpenId(openId === room.id ? null : room.id)}
                  onRemove={() => setPendingRemoval(index)}
                />
              </div>
            ))}
          </div>

          <Button variant="dashed" className="w-full py-3.5" onClick={add}>
            <Plus className="size-4" />
            {t('addRoomType')}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval !== null) removeRoom(pendingRemoval);
          setPendingRemoval(null);
        }}
        title={t('removeRoomType')}
        body={t('removeRoomTypeConfirm')}
        confirmLabel={tCommon('remove')}
      />
    </>
  );
}
