import { NavLink, Outlet } from 'react-router-dom';

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/calendar', label: 'Booking Calendar' },
  { to: '/fees-commissions', label: 'Fee & Commission' },
  { to: '/bookkeeping', label: 'Pembukuan' },
  { to: '/settings/account', label: 'Settings' },
];

function NavigationLink({ item }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'block rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        ].join(' ')
      }
    >
      {item.label}
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="font-semibold">Studio37</div>
      </header>

      <nav
        aria-label="Navigasi utama mobile"
        className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden"
      >
        {navigationItems.map((item) => (
          <NavigationLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="mx-auto grid min-h-screen max-w-[1600px] md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white p-4 md:block">
          <div className="mb-6 px-3 text-lg font-semibold">Studio37</div>
          <nav aria-label="Navigasi utama" className="space-y-1">
            {navigationItems.map((item) => (
              <NavigationLink key={item.to} item={item} />
            ))}
          </nav>
        </aside>

        <main className="min-w-0 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
