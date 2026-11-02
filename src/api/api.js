
const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "LeadPulse request failed."
    );
  }

  return data;
}

export const api = {
  health: () =>
    request("/api/health"),

  accounts: {
    list: () =>
      request("/api/accounts")
  },

  campaigns: {
    list: () =>
      request("/api/campaigns")
  },

  whatsapp: {
    getState: () =>
      request("/api/whatsapp/state")
  },

  leads: {
    list: (filters = {}) => {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== "" &&
          value !== null &&
          value !== undefined
        ) {
          params.set(key, value);
        }
      });

      return request(`/api/leads?${params.toString()}`);
    },

    create: (lead) =>
      request("/api/leads", {
        method: "POST",
        body: JSON.stringify(lead)
      }),

    get: (id) =>
      request(`/api/leads/${id}`)
  }
};
