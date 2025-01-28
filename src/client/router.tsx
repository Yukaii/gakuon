import { Navigate, createHashRouter } from "react-router-dom";
import { DeckView } from "./views/DeckView";
import { CardView } from "./views/CardView";
import { RootLayout } from "./layouts/RootLayout";

export const router = createHashRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/decks" replace />,
      },
      {
        path: "decks",
        element: <DeckView />,
      },
      {
        path: "decks/:deckName",
        element: <DeckView />,
      },
      {
        path: "decks/:deckName/cards/:cardId",
        element: <CardView />,
      },
    ],
  },
]);
