let state = {
  status: "disconnected",
  account: null,
  contacts: []
};

const listeners = new Set();

function emit(event, data = {}) {
  for (const listener of listeners) {
    try {
      listener(event, data);
    } catch (error) {
      console.error(
        "WhatsApp event listener error:",
        error
      );
    }
  }
}

function onEvent(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

async function initializeWhatsApp() {
  if (state.status === "connected") {
    return {
      success: true,
      status: state.status,
      account: state.account
    };
  }

  /*
   * Provider connection belongs here.
   *
   * Do not put WhatsApp Web scraping logic here.
   *
   * The production implementation should authenticate
   * against the selected WhatsApp Business provider and
   * receive the connected business account information.
   */

  state = {
    ...state,
    status: "connecting"
  };

  emit("status", {
    status: "connecting"
  });

  return {
    success: true,
    status: "connecting",
    message:
      "WhatsApp connection initialization started."
  };
}

async function disconnectWhatsApp() {
  state = {
    status: "disconnected",
    account: null,
    contacts: []
  };

  emit("status", {
    status: "disconnected"
  });

  return {
    success: true
  };
}

function getState() {
  return {
    status: state.status,
    account: state.account
  };
}

async function getContacts() {
  return state.contacts;
}

function setConnectedAccount(account) {
  state = {
    ...state,
    status: "connected",
    account
  };

  emit("connected", {
    account
  });
}

function setContacts(contacts) {
  state = {
    ...state,
    contacts: Array.isArray(contacts)
      ? contacts
      : []
  };

  emit("contacts", {
    count: state.contacts.length
  });
}

module.exports = {
  initializeWhatsApp,
  disconnectWhatsApp,
  getContacts,
  getState,
  onEvent,
  setConnectedAccount,
  setContacts
};