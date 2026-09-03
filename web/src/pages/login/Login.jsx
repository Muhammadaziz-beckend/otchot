import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Post from "../../utils/routes/post.js";
import Config from "../../utils/data.jsx";
import { isApiError, errorMessage } from "../../utils/apiHelpers.js";

const Login = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Бэкенд использует стандартный DRF AuthTokenSerializer: поле называется
    // "username", но у нас USERNAME_FIELD = phone, поэтому сюда идёт телефон.
    const res = await Post("/api/auth/login/", { username: phone, password });
    setLoading(false);

    if (isApiError(res) || !res?.data?.token) {
      setError(errorMessage(res, "Неверный телефон или пароль"));
      return;
    }

    // setToken оборачивает значение в { info: <value> }, а Config читает
    // info.token — поэтому передаём объект, а не голую строку токена.
    Config().setToken({ token: res.data.token });
    navigate("/", { replace: true });
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-card__title">Вход</h1>
        <p className="auth-card__subtitle">Бухгалтерия офиса — доступ только для боссов</p>

        <label className="field">
          <span>Телефон</span>
          <input
            type="tel"
            placeholder="+996700000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
    </div>
  );
};

export default Login;
