import { useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Input, Textarea } from '../../components/forms/Field.jsx';
import { Combobox, Select } from '../../components/forms/Select.jsx';
import { PageContext } from '../../components/navigation/PageContext.jsx';
import { Button } from '../../components/ui/Button.jsx';

import './design-system-preview.css';

const sessionOptions = [
  { value: 'rehearsal', label: 'Rehearsal', description: 'Latihan reguler studio' },
  { value: 'recording', label: 'Recording', description: 'Sesi rekaman dengan engineer' },
  { value: 'mixing', label: 'Mixing', description: 'Mixing project audio' },
  { value: 'mastering', label: 'Mastering', description: 'Final mastering project' },
];

export function DesignSystemPreviewPage() {
  const [sessionType, setSessionType] = useState('rehearsal');
  const [operator, setOperator] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { pushToast } = useToast();

  return (
    <section className="design-preview">
      <PageContext
        eyebrow="Internal Preview"
        title="Design System"
        description="Development-only preview for the shared Phase 1 UI primitives."
      />

      <div className="design-preview__grid">
        <article className="design-preview__panel">
          <div className="design-preview__heading">
            <div>
              <p className="design-preview__kicker">Actions</p>
              <h2>Buttons</h2>
            </div>
            <Badge tone="brand">Phase 1B</Badge>
          </div>

          <div className="design-preview__row">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Saving</Button>
          </div>
        </article>

        <article className="design-preview__panel">
          <div className="design-preview__heading">
            <div>
              <p className="design-preview__kicker">Forms</p>
              <h2>Inputs & Textareas</h2>
            </div>
            <Badge tone="info">Accessible labels</Badge>
          </div>

          <div className="design-preview__fields">
            <Input
              label="Customer name"
              placeholder="Nama customer"
              description="Used as the booking display name."
              required
            />
            <Input
              label="Phone number"
              placeholder="08xxxxxxxxxx"
              error="Nomor telepon belum valid."
            />
            <Textarea
              label="Booking notes"
              placeholder="Catatan tambahan untuk operator..."
              description="Keep operational notes concise and useful."
            />
          </div>
        </article>

        <article className="design-preview__panel">
          <div className="design-preview__heading">
            <div>
              <p className="design-preview__kicker">Choice fields</p>
              <h2>Select & Combobox</h2>
            </div>
            <Badge tone="brand">Phase 1C</Badge>
          </div>

          <div className="design-preview__fields">
            <Select
              label="Session type"
              value={sessionType}
              options={sessionOptions}
              onChange={(event) => setSessionType(event.target.value)}
              description="Native select foundation for short fixed option sets."
            />
            <Combobox
              label="Recording operator"
              value={operator}
              onChange={setOperator}
              placeholder="Cari operator..."
              description="Searchable combobox foundation for longer datasets."
              options={[
                { value: 'dimas', label: 'Dimas', description: 'Studio & Recording Operator' },
                { value: 'raka', label: 'Raka', description: 'Recording Engineer' },
                { value: 'nanda', label: 'Nanda', description: 'Studio Operator' },
              ]}
            />
          </div>
        </article>

        <article className="design-preview__panel">
          <div className="design-preview__heading">
            <div>
              <p className="design-preview__kicker">Status</p>
              <h2>Badges</h2>
            </div>
          </div>

          <div className="design-preview__row">
            <Badge>Neutral</Badge>
            <Badge tone="brand">Configured</Badge>
            <Badge tone="success">Lunas</Badge>
            <Badge tone="warning">DP</Badge>
            <Badge tone="danger">Pending</Badge>
            <Badge tone="info">Recording</Badge>
          </div>
        </article>

        <article className="design-preview__panel">
          <div className="design-preview__heading">
            <div>
              <p className="design-preview__kicker">Overlays</p>
              <h2>Dialog</h2>
            </div>
            <Badge tone="brand">Phase 1C</Badge>
          </div>

          <div className="design-preview__row">
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          </div>

          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Confirm booking action"
            description="Dialog foundation for booking, payment, settings, and destructive confirmations."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    pushToast({
                      title: 'Booking action confirmed',
                      message: 'Dialog and toast primitives can work together.',
                      tone: 'success',
                    });
                  }}
                >
                  Confirm
                </Button>
              </>
            }
          >
            <Input label="Reference note" placeholder="Optional note..." data-autofocus="true" />
          </Dialog>
        </article>

        <article className="design-preview__panel">
          <div className="design-preview__heading">
            <div>
              <p className="design-preview__kicker">Feedback</p>
              <h2>Toast states</h2>
            </div>
            <Badge tone="brand">Phase 1C</Badge>
          </div>

          <div className="design-preview__row">
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({ title: 'Saved', message: 'Changes were saved.', tone: 'success' })
              }
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({
                  title: 'Needs attention',
                  message: 'Payment is still pending.',
                  tone: 'warning',
                })
              }
            >
              Warning toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({
                  title: 'Action failed',
                  message: 'Try again or check the connection.',
                  tone: 'danger',
                })
              }
            >
              Error toast
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}
