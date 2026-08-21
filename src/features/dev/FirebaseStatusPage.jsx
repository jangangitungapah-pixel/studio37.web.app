import { Badge } from '../../components/feedback/Badge.jsx';
import { PageContext } from '../../components/navigation/PageContext.jsx';
import { getFirebaseClientStatus } from '../../lib/firebase/client.js';

import './firebase-status.css';

function StatusItem({ label, value, tone = 'neutral' }) {
  return (
    <div className="firebase-status__item">
      <span>{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

export function FirebaseStatusPage() {
  const status = getFirebaseClientStatus();

  return (
    <section className="firebase-status">
      <PageContext
        eyebrow="Phase 2A"
        title="Firebase Client Foundation"
        description="Development-only status for the configured Firebase App, Authentication, and Cloud Firestore clients. This page performs no Firestore reads or writes."
      />

      <article className="firebase-status__panel">
        <div className="firebase-status__heading">
          <div>
            <p className="firebase-status__kicker">Development project</p>
            <h2>{status.projectId}</h2>
          </div>
          <Badge tone={status.configured ? 'success' : 'danger'}>
            {status.configured ? 'Configured' : 'Missing config'}
          </Badge>
        </div>

        <div className="firebase-status__grid">
          <StatusItem label="Environment" value={status.appEnvironment} tone="info" />
          <StatusItem
            label="Firebase App"
            value={status.appInitialized ? 'Initialized' : 'Unavailable'}
            tone={status.appInitialized ? 'success' : 'danger'}
          />
          <StatusItem
            label="Authentication"
            value={status.authInitialized ? 'Initialized' : 'Unavailable'}
            tone={status.authInitialized ? 'success' : 'danger'}
          />
          <StatusItem
            label="Cloud Firestore"
            value={status.firestoreInitialized ? 'Initialized' : 'Unavailable'}
            tone={status.firestoreInitialized ? 'success' : 'danger'}
          />
          <StatusItem
            label="Emulator mode"
            value={status.useFirebaseEmulators ? 'Enabled' : 'Disabled'}
            tone={status.useFirebaseEmulators ? 'warning' : 'neutral'}
          />
          <StatusItem
            label="Analytics"
            value={status.analyticsEligible ? 'Eligible' : 'Deferred'}
            tone={status.analyticsEligible ? 'info' : 'neutral'}
          />
        </div>
      </article>
    </section>
  );
}
