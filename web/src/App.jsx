import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import "./static/css/style.css";

import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";
import Layout from "./components/Layout/Layout.jsx";
import Login from "./pages/login/Login.jsx";
import Dashboard from "./pages/dashboard/Dashboard.jsx";
import Bosses from "./pages/bosses/Bosses.jsx";
import Fund from "./pages/fund/Fund.jsx";
import Expenses from "./pages/expenses/Expenses.jsx";
import Debts from "./pages/debts/Debts.jsx";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bosses" element={<Bosses />} />
            <Route path="/fund" element={<Fund />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/debts" element={<Debts />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
