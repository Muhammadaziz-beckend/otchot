import { useEffect, useState } from "react";
import { listExpenses, createExpense, updateExpense, deleteExpense, listBosses, EXPENSE_CATEGORIES } from "../../api/boss.js";
import { isApiError, errorMessage, formatMoney, buildQuery } from "../../utils/apiHelpers.js";
import Loader from "../../components/Loader/Loader.jsx";
import Modal from "../../components/Modal/Modal.jsx";

// payer: "" - все, "fund" - только из фонда офиса, иначе id босса
const emptyFilters = { payer: "", category: "", date_from: "", date_to: "" };
const emptyForm = { title: "", description: "", category: "other", amount: "", date: "", paid_by: "" };

const toApiFilters = (f) => {
  const api = { category: f.category, date_from: f.date_from, date_to: f.date_to };
  if (f.payer === "fund") api.from_fund = "true";
  else if (f.payer) api.paid_by = f.payer;
  return api;
};

const Expenses = () => {
  const [bosses, setBosses] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
    listExpenses(buildQuery(toApiFilters(appliedFilters))).then((res) => {
      setLoading(false);
      if (isApiError(res)) {
        setError(errorMessage(res, "Не удалось загрузить расходы"));
        return;
      }
      setExpenses(res.data.results ?? res.data);
      setCount(res.data.count ?? (res.data.results ?? res.data).length);
    });
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
    setForm({ ...emptyForm, paid_by: "" });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      description: expense.description ?? "",
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      paid_by: expense.paid_by ?? "",
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
      title: form.title,
      description: form.description || null,
      category: form.category,
      amount: form.amount,
      date: form.date,
      paid_by: form.paid_by || null,
    };

    const res = editingId ? await updateExpense(editingId, payload) : await createExpense(payload);
    setSaving(false);

    if (isApiError(res)) {
      setFormError(errorMessage(res, "Не удалось сохранить расход"));
      return;
    }

    setModalOpen(false);
    load();
  };

  const handleDelete = async (expense) => {
    if (!window.confirm(`Удалить расход «${expense.title}»?`)) return;
    const res = await deleteExpense(expense.id);
    if (isApiError(res)) {
      alert(errorMessage(res, "Не удалось удалить расход"));
      return;
    }
    load();
  };

  const totalOnPage = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Расходы офиса</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate} disabled={bosses.length === 0}>
          + Добавить расход
        </button>
      </div>

      <p className="page-hint">
        Обычно расход оплачивается из фонда офиса — долгов между боссами не возникает. Если
        выбрать конкретного босса, значит он оплатил лично (в обход фонда), и сумма разделится
        между остальными боссами как долг перед ним.
      </p>

      {bosses.length === 0 && !loading && (
        <div className="alert alert-warning">
          Сначала добавьте хотя бы одного босса на странице «Боссы» — без него не с кем делить расходы.
        </div>
      )}

      <form className="filter-bar" onSubmit={applyFilters}>
        <label className="field field--inline">
          <span>Кто оплатил</span>
          <select
            value={filters.payer}
            onChange={(e) => setFilters({ ...filters, payer: e.target.value })}
          >
            <option value="">Все источники</option>
            <option value="fund">Фонд офиса</option>
            {bosses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (лично)
              </option>
            ))}
          </select>
        </label>

        <label className="field field--inline">
          <span>Категория</span>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">Все категории</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
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
              <span className="stat-card__label">Найдено расходов</span>
              <span className="stat-card__value">{count}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Сумма на странице</span>
              <span className="stat-card__value">{formatMoney(totalOnPage)} сом</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Оплатил</th>
                  <th>Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.date}</td>
                    <td>
                      {expense.title}
                      {expense.description && <div className="table__hint">{expense.description}</div>}
                    </td>
                    <td>{expense.category_display}</td>
                    <td>{expense.paid_by_name}</td>
                    <td>{formatMoney(expense.amount)} сом</td>
                    <td className="table__actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(expense)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => handleDelete(expense)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table__empty">
                      Ничего не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <Modal title={editingId ? "Изменить расход" : "Новый расход"} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Название</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Описание</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Категория</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
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
            </div>

            <div className="field-row">
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
                <span>Кто оплатил</span>
                <select
                  value={form.paid_by}
                  onChange={(e) => setForm({ ...form, paid_by: e.target.value })}
                >
                  <option value="">Фонд офиса</option>
                  {bosses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (лично, в обход фонда)
                    </option>
                  ))}
                </select>
              </label>
            </div>

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

export default Expenses;
