import { useState, useCallback } from "react";
import apiClient from "../services/apiClient.js";

function usePing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ping = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/ping");
      setData(response);
    } catch (e) {
      setError(
        e?.message ||
          "No se pudo contactar el backend /ping. Mostrando datos mock."
      );
      const now = new Date().toISOString();
      setData({
        message: "pong (mock)",
        timestamp: now,
        requestId: "mock-request-id"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, ping };
}

export default usePing;

