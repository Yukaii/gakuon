import { Outlet } from "react-router-dom";

export function RootLayout() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gakuon Web</h1>
      <Outlet />
    </div>
  );
}
