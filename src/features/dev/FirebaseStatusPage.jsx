import { useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { PageContext } from '../../components/navigation/PageContext.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { CapabilityGuard } from '../auth/CapabilityGuard.jsx';
import { getFirebaseClientStatus } from '../../lib/firebase/client.js';
import {
  FIRESTORE_CONNECTIVITY_PROBE_PATH,
  probeFirestoreConnectivity,
} from '../../lib/firebase/connectivity.js';

import './firebase-status.css';

function StatusItem({ label, value, tone = 'neutral' }) {
  return (
    <div className="firebase-status__item">
      <span>{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function getProbeTone(probe) {
  if (probe?.reachable && probe.authorized) return 'success';
  if (probe?.reachable) return 'warning';
  return 'danger';
}

function getProbeLabel(probe) {
  if (!probe) return 'Not checked';
  if (probe.state === 'connected') return 'Connected';
  if (probe.state === 'reachable-but-denied') return 'Reachable / Rules denied';
  if (probe.state === 'misconfigured') return 'Client unavailable';
  return `Unavailable (${probe.code})`;
}

export function FirebaseStatusPage() {
  const status = getFirebaseClientStatus();
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);

  const runProbe = async () => {
    setProbing(true);

    try {
      setProbe(await probeFirestoreConnectivity());
    } finally {
      setProbing(false);
    }
  };

  return (
    <section className="firebase-status">
      <PageContext
        eyebrow="Phase 2B"
        title="Firebase Development Foundation"
        description="Development-only status for Firebase clients, emulator routing, and a manual Firestore connectivity probe. The probe runs only when requested and performs one server document read attempt with no writes."
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
            label="Emulator routing"
            value={status.emulatorsConnected ? status.emulatorHost : 'Not connected'}
            tone={status.emulatorsConnected ? 'warning' : 'neutral'}
          />
          <StatusItem
            label="Analytics"
            value={status.analyticsEligible ? 'Eligible' : 'Deferred'}
            tone={status.analyticsEligible ? 'info' : 'neutral'}
          />
          <StatusItem
            label="Firestore connectivity"
            value={getProbeLabel(probe)}
            tone={probe ? getProbeTone(probe) : 'neutral'}
          />
        </div>

        <div className="firebase-status__probe">
          <div>
            <strong>Manual backend probe</strong>
            <p>
              Reads the legal Firestore path{' '}
              <code>
                {FIRESTORE_CONNECTIVITY_PROBE_PATH.collection}/
                {FIRESTORE_CONNECTIVITY_PROBE_PATH.document}
              </code>{' '}
              once. A permission-denied response still proves the configured Firestore backend is
              reachable; Phase 3 will establish authenticated access and Security Rules.
            </p>
          </div>
          <CapabilityGuard ownerOnly>
            <Button onClick={runProbe} loading={probing}>
              Run Firestore probe
            </Button>
          </CapabilityGuard>
        </div>
      </article>
    </section>
  );
}
