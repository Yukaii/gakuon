import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import './index.css'

export function App() {
  return <RouterProvider router={router} />;
}
