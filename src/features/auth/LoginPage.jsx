import { Link } from 'react-router-dom';

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Phase 0 Foundation
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Studio37 Login</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Firebase Authentication is intentionally wired in Phase 3. This route exists now so the
          application architecture does not need to be reorganized later.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Open foundation shell
        </Link>
      </section>
    </main>
  );
}
