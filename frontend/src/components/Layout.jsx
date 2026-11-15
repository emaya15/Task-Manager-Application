import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

/** Shell for all authenticated pages. */
export default function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="container page">
        <Outlet />
      </main>
    </div>
  );
}
