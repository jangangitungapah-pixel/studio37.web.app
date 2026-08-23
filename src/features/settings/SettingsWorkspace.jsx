import { PageContext } from '../../components/navigation/PageContext.jsx';
import { SettingsNavigation } from './SettingsNavigation.jsx';
import './settings.css';

export function SettingsWorkspace({ actions, children, description, title }) {
  return (
    <section className="settings-workspace">
      <PageContext eyebrow="Pengaturan" title={title} description={description} actions={actions} />
      <SettingsNavigation />
      <div className="settings-workspace__content">{children}</div>
    </section>
  );
}
