import { PageContext } from '../../components/navigation/PageContext.jsx';

import './authorization.css';

export function AccessDeniedPage() {
  return (
    <section>
      <PageContext
        eyebrow="Access control"
        title="Akses tidak diizinkan"
        description="Akun ini aktif, tetapi permission yang ditetapkan tidak mengizinkan area tersebut."
      />

      <div className="authorization-denied" role="alert">
        <p className="authorization-denied__title">Permission diperlukan</p>
        <p className="authorization-denied__description">
          Gunakan menu yang tersedia atau hubungi Owner Studio37 bila akses operasional ini memang
          diperlukan.
        </p>
      </div>
    </section>
  );
}
