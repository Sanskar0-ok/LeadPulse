const {
  contextBridge,
  ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld("leadPulse", {
  accounts: {
    list: () =>
      ipcRenderer.invoke("accounts:list"),

    addSmtp: (payload) =>
      ipcRenderer.invoke("accounts:add-smtp", payload),

    remove: (accountId) =>
      ipcRenderer.invoke("accounts:remove", accountId),

    startGoogleOAuth: () =>
      ipcRenderer.invoke("oauth:start-google")
  },

  campaigns: {
    list: () =>
      ipcRenderer.invoke("campaigns:list"),

    logs: (campaignId) =>
      ipcRenderer.invoke("campaigns:logs", campaignId),

    launch: (payload) =>
      ipcRenderer.invoke("campaigns:launch", payload)
  },

  spam: {
    analyze: (subject, body) =>
      ipcRenderer.invoke(
        "spam:analyze",
        subject,
        body
      )
  },

  whatsapp: {
    connect: () =>
      ipcRenderer.invoke("whatsapp:connect"),

    disconnect: () =>
      ipcRenderer.invoke("whatsapp:disconnect"),

    getState: () =>
      ipcRenderer.invoke("whatsapp:get-state"),

    getContacts: () =>
      ipcRenderer.invoke("whatsapp:get-contacts")
  },

  onTelemetry: (callback) => {
    const listener = (_event, data) =>
      callback(data);

    ipcRenderer.on(
      "telemetry",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "telemetry",
        listener
      );
    };
  },

  onOAuthComplete: (callback) => {
    const listener = () =>
      callback();

    ipcRenderer.on(
      "oauth-complete",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "oauth-complete",
        listener
      );
    };
  },

  onWhatsAppEvent: (callback) => {
    const listener = (_event, data) =>
      callback(data);

    ipcRenderer.on(
      "whatsapp:event",
      listener
    );

    return () => {
      ipcRenderer.removeListener(
        "whatsapp:event",
        listener
      );
    };
  }
});