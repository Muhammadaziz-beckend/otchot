// Тонкий слой над /api/v1/bosses/, /office-expenses/ и /debts/.
// Токен берём из Config() при каждом вызове, чтобы не хранить его в замыкании.
import Config from "../utils/data.jsx";
import Get from "../utils/routes/get.js";
import Post from "../utils/routes/post.js";
import Put from "../utils/routes/put.js";
import Del from "../utils/routes/del.js";

const token = () => Config().token;

// --- Боссы ---
export const listBosses = (query = "") => Get(`/bosses/${query}`, token());
export const createBoss = (data) => Post("/bosses/", data, token());
export const updateBoss = (id, data) => Put(`/bosses/${id}/`, data, token());
export const deleteBoss = (id) => Del(`/bosses/${id}/`, token());
export const bossSummary = (id, query = "") => Get(`/bosses/${id}/summary/${query}`, token());
export const officeReport = (query = "") => Get(`/bosses/report/${query}`, token());

// --- Расходы офиса ---
export const listExpenses = (query = "") => Get(`/office-expenses/${query}`, token());
export const createExpense = (data) => Post("/office-expenses/", data, token());
export const updateExpense = (id, data) => Put(`/office-expenses/${id}/`, data, token());
export const deleteExpense = (id) => Del(`/office-expenses/${id}/`, token());

// --- Взносы в фонд офиса ---
export const listContributions = (query = "") => Get(`/office-contributions/${query}`, token());
export const createContribution = (data) => Post("/office-contributions/", data, token());
export const updateContribution = (id, data) => Put(`/office-contributions/${id}/`, data, token());
export const deleteContribution = (id) => Del(`/office-contributions/${id}/`, token());

// --- Долги ---
export const listDebts = (query = "") => Get(`/debts/${query}`, token());
export const settleDebt = (id, data) => Post(`/debts/${id}/settle/`, data, token());

export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Аренда" },
  { value: "utilities", label: "Коммунальные услуги" },
  { value: "repair", label: "Ремонт" },
  { value: "supplies", label: "Хозтовары" },
  { value: "salary", label: "Зарплата персонала" },
  { value: "other", label: "Другое" },
];
