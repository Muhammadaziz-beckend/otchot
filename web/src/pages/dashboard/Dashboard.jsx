import { useEffect, useState } from "react";
import { officeReport } from "../../api/boss.js";
import { isApiError, errorMessage, formatMoney, buildQuery } from "../../utils/apiHelpers.js";
import Loader from "../../components/Loader/Loader.jsx";

const emptyFilters = { date_from: "", date_to: "" };

const Dashboard = () => {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    officeReport(buildQuery(appliedFilters)).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (isApiError(res)) {
        setError(errorMessage(res, "Не удалось загрузить отчёт"));
        return;
      }
      setReport(res.data);
    });

    return () => {
      cancelled = true;
    };
  }, [appliedFilters]);

  const applyFilters = (e) => {
    e.preventDefault();
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const sharesTotal = report ? Number(report.shares_total_percent) : null;
  const sharesMismatch = sharesTotal !== null && Math.abs(sharesTotal - 100) > 0.01;

  return (
    <div>
      <div className="page-header">
        <h1>Дашборд офиса</h1>
      </div>

      <form className="filter-bar" onSubmit={applyFilters}>
        <label className="field field--inline">
          <span>С даты</span>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          />
        </label>
        <label className="field field--inline">
          <span>По дату</span>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Показать
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetFilters}>
          Сбросить
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <Loader />}

      {!loading && report && (
        <>
          <div className="stat-row">
            <div className={"stat-card" + (Number(report.fund_balance) < 0 ? " stat-card--warning" : "")}>
              <span className="stat-card__label">Баланс фонда офиса (сейчас)</span>
              <span
                className={"stat-card__value " + (Number(report.fund_balance) < 0 ? "text-negative" : "text-positive")}
              >
                {formatMoney(report.fund_balance)} сом
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Взносы в фонд за период</span>
              <span className="stat-card__value">{formatMoney(report.total_contributions)} сом</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Расходы из фонда за период</span>
              <span className="stat-card__value">{formatMoney(report.total_expenses_from_fund)} сом</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Оплачено лично боссами за период</span>
              <span className="stat-card__value">{formatMoney(report.total_expenses_personal)} сом</span>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-card">
              <span className="stat-card__label">Все расходы офиса за период</span>
              <span className="stat-card__value">{formatMoney(report.total_expenses)} сом</span>
            </div>
            <div className={"stat-card" + (sharesMismatch ? " stat-card--warning" : "")}>
              <span className="stat-card__label">Сумма долей боссов</span>
              <span className="stat-card__value">{formatMoney(report.shares_total_percent)}%</span>
              {sharesMismatch && (
                <span className="stat-card__hint">
                  Должна быть 100% — проверьте доли на странице «Боссы»
                </span>
              )}
            </div>
          </div>

          <div className="boss-cards">
            {report.bosses.map((item) => {
              const positive = Number(item.net_debt_balance) >= 0;
              return (
                <div className="card boss-card" key={item.boss.id}>
                  <div className="boss-card__header">
                    <h3>{item.boss.name}</h3>
                    <span className="badge">{formatMoney(item.boss.share_percent)}%</span>
                  </div>

                  <dl className="kv-list">
                    <div className="kv-list__row">
                      <dt>Вложил в фонд</dt>
                      <dd>{formatMoney(item.total_contributed)} сом</dd>
                    </div>
                    <div className="kv-list__row">
                      <dt>Оплатил лично</dt>
                      <dd>{formatMoney(item.total_paid)} сом</dd>
                    </div>
                    <div className="kv-list__row">
                      <dt>Его доля от расходов</dt>
                      <dd>{formatMoney(item.total_obligation)} сом</dd>
                    </div>
                    <div className="kv-list__row">
                      <dt>Баланс по расходам</dt>
                      <dd className={Number(item.balance) >= 0 ? "text-positive" : "text-negative"}>
                        {formatMoney(item.balance)} сом
                      </dd>
                    </div>
                  </dl>

                  <div className="boss-card__debts">
                    <div className="kv-list__row">
                      <dt>Ему должны</dt>
                      <dd className="text-positive">{formatMoney(item.owed_to_him)} сом</dd>
                    </div>
                    <div className="kv-list__row">
                      <dt>Он должен</dt>
                      <dd className="text-negative">{formatMoney(item.owes_to_others)} сом</dd>
                    </div>
                    <div className="kv-list__row kv-list__row--total">
                      <dt>Текущее сальдо долгов</dt>
                      <dd className={positive ? "text-positive" : "text-negative"}>
                        {formatMoney(item.net_debt_balance)} сом
                      </dd>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
