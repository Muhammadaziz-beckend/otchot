import { NavLink, Outlet, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Дашборд", end: true },
  { to: "/bosses", label: "Боссы" },
  { to: "/fund", label: "Фонд офиса" },
  { to: "/expenses", label: "Расходы офиса" },
  { to: "/debts", label: "Долги" },
];

const Layout = () => {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("userToken");
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">Бухгалтерия офиса</div>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => "app-nav__link" + (isActive ? " app-nav__link--active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Выйти
        </button>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
