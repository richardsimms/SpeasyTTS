import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import Dashboard from "./pages/Dashboard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route>404 Page Not Found</Route>
      </Switch>
      <Toaster />
    </SWRConfig>
  </StrictMode>,
);
