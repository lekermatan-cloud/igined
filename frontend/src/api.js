const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8787";

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
    this.token = localStorage.getItem("sigined_token");
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("sigined_token", token);
    } else {
      localStorage.removeItem("sigined_token");
    }
  }

  getToken() {
    if (!this.token) {
this.token = localStorage.getItem("sigined_token");
    }
    return this.token;
  }

  async request(method, path, body = null) {
    const headers = {
      "Content-Type": "application/json",
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  get(path) {
    return this.request("GET", path);
  }

  post(path, body) {
    return this.request("POST", path, body);
  }

  patch(path, body) {
    return this.request("PATCH", path, body);
  }

  delete(path) {
    return this.request("DELETE", path);
  }
}

export const api = new ApiClient();

export const auth = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  google: (credential) => api.post("/auth/google", { credential }),
  logout: () => api.post("/auth/logout", {}),
  me: () => api.get("/auth/me"),
  verifyEmail: (token) => api.post("/auth/verify-email", { token }),
  resendVerification: () => api.post("/auth/resend-verification", {}),
  resetPassword: (email) => api.post("/auth/reset-password", { email }),
  updatePassword: (password) => api.post("/auth/update-password", { password }),
};

export const users = {
  getMe: () => api.get("/users/me"),
  updateMe: (data) => api.patch("/users/me", data),
  updateAvatar: async (avatarUrl) => {
    const headers = {
      "Authorization": `Bearer ${api.getToken()}`,
    };
    const response = await fetch(`${api.baseUrl}/users/me/avatar`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },
  updateSignature: async (signatureDataUrl) => {
    const headers = {
      "Authorization": `Bearer ${api.getToken()}`,
      "Content-Type": "application/json",
    };
    const response = await fetch(`${api.baseUrl}/users/me/signature`, {
      method: "POST",
      headers,
      body: JSON.stringify({ signature_url: signatureDataUrl }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },
  updatePassword: (password, currentPassword) => api.post("/auth/update-password", { password, current_password: currentPassword }),
  getUser: (id) => api.get(`/users/${id}`),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/users${query ? `?${query}` : ""}`);
  },
  suspend: (id, reason) => api.patch(`/users/${id}/suspend`, { reason }),
  activate: (id) => api.patch(`/users/${id}/activate`, {}),
};

export const documents = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/documents${query ? `?${query}` : ""}`);
  },
  get: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post("/documents", data),
  update: (id, data) => api.patch(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  send: (id, signers) => api.post(`/documents/${id}/send`, { signers }),
  upload: async (file, name, teamId = null) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    if (teamId) {
      formData.append("team_id", teamId);
    }

    const headers = {
      Authorization: `Bearer ${api.getToken()}`,
    };

    const response = await fetch(`${api.baseUrl}/documents`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  },
  getDownloadUrl: async (id) => {
    return api.get(`/documents/${id}/download`);
  },
  getFields: (id) => api.get(`/documents/${id}/fields`),
  saveFields: (id, fields) => api.post(`/documents/${id}/fields`, { fields }),
};

export const teams = {
  list: () => api.get("/teams"),
  get: (id) => api.get(`/teams/${id}`),
  update: (id, data) => api.patch(`/teams/${id}`, data),
  getMembers: (id) => api.get(`/teams/${id}/members`),
  inviteMember: (id, email, role) => api.post(`/teams/${id}/invite`, { email, role }),
  removeMember: (id, userId) => api.delete(`/teams/${id}/members/${userId}`),
  updateMember: (id, userId, role) => api.patch(`/teams/${id}/members/${userId}`, { role }),
};

export const referrals = {
  getStats: () => api.get("/referrals/stats"),
  validate: (code) => api.get(`/referrals/validate/${code}`),
};

export const dashboard = {
  getStats: () => api.get("/dashboard/stats"),
};

export const apiKeys = {
  list: () => api.get("/api-keys"),
  create: (name) => api.post("/api-keys", { name }),
  delete: (id) => api.delete(`/api-keys/${id}`),
};

export const billing = {
  checkout: (plan, currency = "USD", returnUrl) => api.post("/billing/checkout", { plan, currency, return_url: returnUrl }),
  portal: () => api.post("/billing/portal"),
  getSubscription: () => api.get("/billing/subscription"),
  getInvoices: () => api.get("/billing/invoices"),
};