const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return "";
};

const baseUrl = getBaseUrl();

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const message =
      text || `Request failed with status ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

const apiClient = {
  get: (path) => request(path, { method: "GET" })
};

export default apiClient;

