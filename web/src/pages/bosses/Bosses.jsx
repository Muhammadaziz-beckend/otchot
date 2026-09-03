import { useEffect, useState } from "react";
import { listBosses, createBoss, updateBoss, deleteBoss, officeReport } from "../../api/boss.js";
import { isApiError, errorMessage, formatMoney, buildQuery } from "../../utils/apiHelpers.js";
import Loader from "../../components/Loader/Loader.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import Pagination from "../../components/Pagination/Pagination.jsx";

const emptyForm = { name: "", phone: "", share_percent: "", is_active: true };

const Bosses = () => {
  const [bosses, setBosses] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [sharesTotal, setSharesTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([listBosses(buildQuery({ page })), officeReport()]).then(([res, reportRes]) => {
      setLoading(false);
      if (isApiError(res)) {
        setError(errorMessage(res, "Не удалось загрузить список боссов"));
        return;
      }
      setBosses(res.data.results ?? res.data);
      setCount(res.data.count ?? (res.data.results ?? res.data).length);
      // shares_total_percent считается на бэкенде по всем активным боссам,
      // а не только по текущей странице - иначе с пагинацией цифра была бы неверной.
      if (!isApiError(reportRes)) setSharesTotal(Number(reportRes.data.shares_total_percent));
    });
  };

  useEffect(load, [page]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (boss) => {
    setEditingId(boss.id);
    setForm({
      name: boss.name,
      phone: boss.phone ?? "",
      share_percent: boss.share_percent,
      is_active: boss.is_active,
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
      name: form.name,
      phone: form.phone || null,
      share_percent: form.share_percent,
      is_active: form.is_active,
    };

    const res = editingId ? await updateBoss(editingId, payload) : await createBoss(payload);
    setSaving(false);

    if (isApiError(res)) {
      setFormError(errorMessage(res, "Не удалось сохранить босса"));
      return;
    }

    setModalOpen(false);
    load();
  };

  const handleDelete = async (boss) => {
    if (!window.confirm(`Удалить босса «${boss.name}»?`)) return;
    const res = await deleteBoss(boss.id);
    if (isApiError(res)) {
      alert(errorMessage(res, "Не удалось удалить босса"));
      return;
    }
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Боссы</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Добавить босса
        </button>
      </div>

      {sharesTotal !== null && Math.abs(sharesTotal - 100) > 0.01 && (
        <div className="alert alert-warning">
          Сумма долей активных боссов — {formatMoney(sharesTotal)}%, а должна быть 100%.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <Loader />}

      {!loading && (
        <>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Доля</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bosses.map((boss) => (
                <tr key={boss.id}>
                  <td>{boss.name}</td>
                  <td>{boss.phone || "—"}</td>
                  <td>{formatMoney(boss.share_percent)}%</td>
                  <td>
                    <span className={"badge " + (boss.is_active ? "badge--ok" : "badge--muted")}>
                      {boss.is_active ? "Активен" : "Неактивен"}
                    </span>
                  </td>
                  <td className="table__actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(boss)}>
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => handleDelete(boss)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {bosses.length === 0 && (
                <tr>
                  <td colSpan={5} className="table__empty">
                    Пока нет боссов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} count={count} onChange={setPage} />
        </>
      )}

      {modalOpen && (
        <Modal title={editingId ? "Изменить босса" : "Новый босс"} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Имя</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Телефон</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="необязательно"
              />
            </label>

            <label className="field">
              <span>Доля в офисе, %</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.share_percent}
                onChange={(e) => setForm({ ...form, share_percent: e.target.value })}
                required
              />
            </label>

            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>Активен (участвует в разделении расходов)</span>
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

export default Bosses;
