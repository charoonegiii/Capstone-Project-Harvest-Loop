import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV = {
  farmer: [
    ['/dashboard', 'Dashboard'],
    ['/my-listings', 'My listings'],
    ['/offers', 'Offers'],
    ['/bookings', 'Bookings'],
    ['/listings', 'Marketplace'],
  ],
  buyer: [
    ['/dashboard', 'Dashboard'],
    ['/listings', 'Find residue'],
    ['/offers', 'My offers'],
    ['/bookings', 'My orders'],
  ],
  transporter: [
    ['/dashboard', 'Dashboard'],
    ['/jobs', 'Open jobs'],
    ['/bookings', 'My jobs'],
    ['/profile', 'Vehicle'],
  ],
  admin: [
    ['/dashboard', 'Dashboard'],
    ['/admin', 'Admin'],
    ['/listings', 'Marketplace'],
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const links = user ? NAV[user.role] : [['/listings', 'Browse residue']];

  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden>♻</span> HarvestLoop
          </Link>
          <nav className="nav" aria-label="Main">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="userbox">
            {user ? (
              <>
                <Link to="/profile" style={{ color: '#fff' }}>{user.name}</Link>
                <span className="role-chip">{user.role}</span>
                <button
                  className="btn secondary sm"
                  onClick={() => {
                    logout();
                    nav('/');
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn secondary sm">Log in</Link>
                <Link to="/register" className="btn gold sm">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
      <footer className="site">
        <div className="container">
          HarvestLoop is a coordination and marketplace tool. It does not guarantee material quality, legal
          compliance or any environmental outcome &mdash; users should verify material condition, quantity and terms
          before finalizing a sale. Earnings shown are estimates based on agreed prices.
        </div>
      </footer>
    </>
  );
}
