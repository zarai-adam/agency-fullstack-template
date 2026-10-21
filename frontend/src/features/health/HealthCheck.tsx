
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";

type HealthResponse = {
  status: string;
};

type ConnectionState = "loading" | "success" | "error";

export function HealthCheck() {
  const [state, setState] = useState<ConnectionState>("loading");

  useEffect(() => {
    let cancelled = false;

    apiRequest<HealthResponse>("health")
      .then((data) => {
        if (cancelled) return;
        setState(data.status === "ok" ? "success" : "error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <p role="status">Checking API connection...</p>;
  }

  if (state === "success") {
    return <p role="status">API connected successfully</p>;
  }

  return <p role="alert">API connection failed</p>;
}
