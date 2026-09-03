import { useEffect, useState } from "react";
import { listDebts, settleDebt, listBosses } from "../../api/boss.js";
import { isApiError, errorMessage, formatMoney, buildQuery } from "../../utils/apiHelpers.js";
import Loader from "../../components/Loader/Loader.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import Pagination from "../../components/Pagination/Pagination.jsx";

const emptyFilters = { debtor: "", creditor: "", is_settled: "false" };

const today = () => new Date().toISOString().slice(0, 10);

const Debts = () => {
  const [bosses, setBosses] = useState([]);
  const [debts, setDebts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [settleTarget, setSettleTarget] = useState(null);
  const [settleForm, setSettleForm] = useState({ amount: "", date: today(), comment: "" });
  const [settleError, setSettleError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listBosses().then((res) => {
      if (!isApiError(res)) setBosses(res.data.results ?? res.data);
    });
  }, []);

  const load = () => {
    setLoading(true);
    setError("");
    listDebts(buildQuery({ ...appliedFilters, page })).then((res) => {
      setLoading(false);
      if (isApiError(res)) {
        setError(errorMessage(res, "Не удалось загрузить долги"));
        return;
      }
      setDebts(res.data.results ?? res.data);
      setCount(res.data.count ?? (res.data.results ?? res.data).length);
    });
  };

  useEffect(load, [appliedFilters, page]);

  const applyFilters = (e) => {
    e.preventDefault();
    setAppliedFilters(filters);
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const openSettle = (debt) => {
    setSettleTarget(debt);
    setSettleForm({ amount: debt.remaining_amount, date: today(), comment: "" });
    setSettleError("");
  };

  const closeSettle = () => setSettleTarget(null);

  const handleSettle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSettleError("");

    const res = await settleDebt(settleTarget.id, settleForm);
    setSaving(false);

    if (isApiError(res)) {
      setSettleError(errorMessage(res, "Не удалось зафиксировать погашение"));
      return;
    }

    setSettleTarget(null);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Долги между боссами</h1>
      </div>

      <p className="page-hint">
        Долги создаются автоматически, когда один босс оплачивает расход офиса за всех — доли
        остальных боссов становятся их долгом перед ним. Отмечайте здесь фактический возврат денег.
      </p>

      <form className="filter-bar" onSubmit={applyFilters}>
        <label className="field field--inline">
          <span>Должник</span>
          <select value={filters.debtor} onChange={(e) => setFilters({ ...filters, debtor: e.target.value })}>
            <option value="">Все</option>
            {bosses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--inline">
          <span>Кредитор</span>
          <select value={filters.creditor} onChange={(e) => setFilters({ ...filters, creditor: e.target.value })}>
            <option value="">Все</option>
            {bosses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--inline">
          <span>Статус</span>
          <select
            value={filters.is_settled}
            onChange={(e) => setFilters({ ...filters, is_settled: e.target.value })}
          >
            <option value="">Все</option>
            <option value="false">Непогашенные</option>
            <option value="true">Погашенные</option>
          </select>
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

      {!loading && (
        <>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Должник</th>
                <th>Кредитор</th>
                <th>Сумма долга</th>
                <th>Погашено</th>
                <th>Остаток</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {debts.map((debt) => (
                <tr key={debt.id}>
                  <td>{debt.debtor_name}</td>
                  <td>{debt.creditor_name}</td>
                  <td>{formatMoney(debt.amount)} сом</td>
                  <td>{formatMoney(debt.repaid_amount)} сом</td>
                  <td>{formatMoney(debt.remaining_amount)} сом</td>
                  <td>
                    <span className={"badge " + (debt.is_settled ? "badge--ok" : "badge--warning")}>
                      {debt.is_settled ? "Погашен" : "Не погашен"}
                    </span>
                  </td>
                  <td className="table__actions">
                    {!debt.is_settled && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openSettle(debt)}>
                        Погасить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {debts.length === 0 && (
                <tr>
                  <td colSpan={7} className="table__empty">
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} count={count} onChange={setPage} />
        </>
      )}

      {settleTarget && (
        <Modal title={`Погашение долга: ${settleTarget.debtor_name} → ${settleTarget.creditor_name}`} onClose={closeSettle}>
          <form onSubmit={handleSettle}>
            <p className="page-hint">
              Остаток долга: {formatMoney(settleTarget.remaining_amount)} сом
            </p>

            <label className="field">
              <span>Сумма погашения, сом</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={settleTarget.remaining_amount}
                value={settleForm.amount}
                onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Дата</span>
              <input
                type="date"
                value={settleForm.date}
                onChange={(e) => setSettleForm({ ...settleForm, date: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Комментарий</span>
              <input
                type="text"
                placeholder="необязательно"
                value={settleForm.comment}
                onChange={(e) => setSettleForm({ ...settleForm, comment: e.target.value })}
              />
            </label>

            {settleError && <div className="alert alert-error">{settleError}</div>}

            <div className="modal__footer">
              <button type="button" className="btn btn-ghost" onClick={closeSettle}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Сохраняем..." : "Подтвердить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Debts;
