import { useEffect, useState } from "react";
import {
  listContributions,
  createContribution,
  updateContribution,
  deleteContribution,
  listBosses,
  officeReport,
} from "../../api/boss.js";
import { isApiError, errorMessage, formatMoney, buildQuery } from "../../utils/apiHelpers.js";
import Loader from "../../components/Loader/Loader.jsx";
import Modal from "../../components/Modal/Modal.jsx";

const emptyFilters = { boss: "", date_from: "", date_to: "" };
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ boss: "", amount: "", date: today(), comment: "" });

const Fund = () => {
  const [bosses, setBosses] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [fundBalance, setFundBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listBosses().then((res) => {
      if (!isApiError(res)) setBosses(res.data.results ?? res.data);
    });
  }, []);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([listContributions(buildQuery(appliedFilters)), officeReport()]).then(
      ([contribRes, reportRes]) => {
        setLoading(false);
        if (isApiError(contribRes)) {
          setError(errorMessage(contribRes, "Не удалось загрузить взносы"));
          return;
        }
        setContributions(contribRes.data.results ?? contribRes.data);
        if (!isApiError(reportRes)) setFundBalance(reportRes.data.fund_balance);
      }
    );
  };

  useEffect(load, [appliedFilters]);

  const applyFilters = (e) => {
    e.preventDefault();
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), boss: bosses[0]?.id ?? "" });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (contribution) => {
    setEditingId(contribution.id);
    setForm({
      boss: contribution.boss,
      amount: contribution.amount,
      date: contribution.date,
      comment: contribution.comment ?? "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      boss: form.boss,
      amount: form.amount,
      date: form.date,
      comment: form.comment || null,
    };

    const res = editingId
      ? await updateContribution(editingId, payload)
      : await createContribution(payload);
    setSaving(false);

    if (isApiError(res)) {
      setFormError(errorMessage(res, "Не удалось сохранить взнос"));
      return;
    }

    setModalOpen(false);
    load();
  };

  const handleDelete = async (contribution) => {
    if (!window.confirm(`Удалить взнос ${contribution.boss_name} на ${formatMoney(contribution.amount)} сом?`))
      return;
    const res = await deleteContribution(contribution.id);
    if (isApiError(res)) {
      alert(errorMessage(res, "Не удалось удалить взнос"));
      return;
    }
    load();
  };

  const totalOnPage = contributions.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Фонд офиса</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate} disabled={bosses.length === 0}>
          + Добавить взнос
        </button>
      </div>

      <p className="page-hint">
        Боссы вкладывают деньги в общий фонд офиса. Пока в фонде есть деньги, расходы платятся из
        него и никто из боссов лично в минус не уходит — долг между боссами возникает только
        когда кто-то из них платит за офис лично, в обход фонда (см. страницу «Расходы офиса»).
      </p>

      {bosses.length === 0 && !loading && (
        <div className="alert alert-warning">
          Сначала добавьте хотя бы одного босса на странице «Боссы».
        </div>
      )}

      <form className="filter-bar" onSubmit={applyFilters}>
        <label className="field field--inline">
          <span>Кто вложил</span>
          <select value={filters.boss} onChange={(e) => setFilters({ ...filters, boss: e.target.value })}>
            <option value="">Все боссы</option>
            {bosses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

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

      {!loading && (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <span className="stat-card__label">Текущий баланс фонда</span>
              <span className={"stat-card__value " + (Number(fundBalance) < 0 ? "text-negative" : "text-positive")}>
                {fundBalance !== null ? formatMoney(fundBalance) : "…"} сом
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Сумма взносов на странице</span>
              <span className="stat-card__value">{formatMoney(totalOnPage)} сом</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Босс</th>
                  <th>Сумма</th>
                  <th>Комментарий</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.id}>
                    <td>{c.date}</td>
                    <td>{c.boss_name}</td>
                    <td>{formatMoney(c.amount)} сом</td>
                    <td>{c.comment || "—"}</td>
                    <td className="table__actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => handleDelete(c)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
                {contributions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table__empty">
                      Пока нет взносов
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <Modal title={editingId ? "Изменить взнос" : "Новый взнос"} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Босс</span>
              <select value={form.boss} onChange={(e) => setForm({ ...form, boss: e.target.value })} required>
                {bosses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Сумма, сом</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Дата</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Комментарий</span>
              <input
                type="text"
                placeholder="необязательно"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </label>

            {formError && <div className="alert alert-error">{formError}</div>}

            <div className="modal__footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Fund;
