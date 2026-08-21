import { Badge } from '../../components/feedback/Badge.jsx';
import { Input, Textarea } from '../../components/forms/Field.jsx';
import { PageContext } from '../../components/navigation/PageContext.jsx';
import { Button } from '../../components/ui/Button.jsx';

import './design-system-preview.css';

export function DesignSystemPreviewPage() {
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
      </div>
    </section>
  );
}
