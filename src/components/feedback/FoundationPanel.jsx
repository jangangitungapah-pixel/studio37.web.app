import { PageContext } from '../navigation/PageContext.jsx';

import './foundation-panel.css';

export function FoundationPanel({ eyebrow = 'Foundation', title, description }) {
  return (
    <section>
      <PageContext eyebrow={eyebrow} title={title} description={description} />

      <div className="foundation-panel" aria-label={`${title} foundation status`}>
        <span className="foundation-panel__dot" aria-hidden="true" />
        <div>
          <p className="foundation-panel__title">Workspace foundation ready</p>
          <p className="foundation-panel__description">
            Business content for this module will be added in its dedicated implementation phase.
          </p>
        </div>
      </div>
    </section>
  );
}
