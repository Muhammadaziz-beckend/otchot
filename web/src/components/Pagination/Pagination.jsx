import { PAGE_SIZE } from "../../utils/apiHelpers.js";

// count - общее число элементов с бэкенда (DRF PageNumberPagination),
// page - текущая страница (1-based), onChange(page) - переключение страницы.
const Pagination = ({ page, count, onChange, pageSize = PAGE_SIZE }) => {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className="pagination">
      <span className="pagination__info">
        {from}–{to} из {count}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ← Назад
        </button>
        <span className="pagination__page">
          Стр. {page} из {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Вперёд →
        </button>
      </div>
    </div>
  );
};

export default Pagination;
