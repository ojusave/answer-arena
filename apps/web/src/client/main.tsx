import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "@mantine/charts/styles.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";
import "./playground.css";
import "./workspace.css";
import App from "./App";

const theme = createTheme({
  primaryColor: "renderPurple",
  colors: {
    renderPurple: [
      "#fbfaff",
      "#f4f0ff",
      "#e7dbff",
      "#d1b8ff",
      "#c29eff",
      "#aa77fd",
      "#8a05ff",
      "#48008c",
      "#2a0052",
      "#1c0037",
    ],
  },
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 0,
  fontFamily: '"PP Neue Montreal", Arial, sans-serif',
  fontFamilyMonospace: '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, monospace',
  headings: {
    fontFamily: "Roobert, Arial, sans-serif",
    fontWeight: "400",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.05" },
      h2: { fontSize: "1.5rem", lineHeight: "1.15" },
      h3: { fontSize: "1.125rem", lineHeight: "1.25" },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="top-right" />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
