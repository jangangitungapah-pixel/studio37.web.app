import { SettingsWorkspace } from './SettingsWorkspace.jsx';

export function SettingsPage({ title }) {
  return (
    <SettingsWorkspace
      title={title}
      description="Subhalaman ini sudah memiliki jalur akses yang aman dan akan diaktifkan pada phase implementasinya."
    >
      <div className="settings-placeholder" role="status">
        <span className="settings-placeholder__dot" aria-hidden="true" />
        <div>
          <p className="settings-placeholder__title">Fondasi halaman siap</p>
          <p className="settings-placeholder__description">
            Form konfigurasi untuk bagian ini belum termasuk dalam slice Phase 4A.
          </p>
        </div>
      </div>
    </SettingsWorkspace>
  );
}
