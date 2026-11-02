const {
  app,
  BrowserWindow,
  ipcMain,
  shell
} = require("electron");

const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");
const { OAuth2Client } = require("google-auth-library");

const {
  initializeDatabase,
  getAccounts,
  createAccount,
  getCampaigns,
  getCampaignLogs,
  removeAccount
} = require("./db");

const {
  launchCampaign
} = require("./rotator");

const {
  analyzeSpam
} = require("./spamAnalyzer");

const {
  initializeWhatsApp,
  disconnectWhatsApp,
  getContacts,
  getState,
  onEvent,
} = require("./whatsapp");

let mainWindow = null;
let oauthServer = null;

const OAUTH_PORT = 53682;
const OAUTH_REDIRECT =
  `http://127.0.0.1:${OAUTH_PORT}/oauth2callback`;

function sendTelemetry(event) {
  if (
    mainWindow &&
    !mainWindow.isDestroyed()
  ) {
    mainWindow.webContents.send(
      "telemetry",
      event
    );
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#020617",
    title: "LeadPulse",
    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.js"
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const developmentUrl =
    process.env.ELECTRON_START_URL;

  if (developmentUrl) {
    mainWindow.loadURL(developmentUrl);
  } else {
    mainWindow.loadFile(
      path.join(
        __dirname,
        "..",
        "..",
        "dist",
        "index.html"
      )
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getGoogleCredentials() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before starting LeadPulse."
    );
  }

  return {
    clientId,
    clientSecret
  };
}

function createOAuthClient() {
  const {
    clientId,
    clientSecret
  } = getGoogleCredentials();

  return new OAuth2Client(
    clientId,
    clientSecret,
    OAUTH_REDIRECT
  );
}

function createStateToken() {
  return crypto
    .randomBytes(24)
    .toString("hex");
}

async function startGoogleOAuth() {
  if (oauthServer) {
    try {
      oauthServer.close();
    } catch {
      // Existing server may already be closing.
    }

    oauthServer = null;
  }

  const oauthClient =
    createOAuthClient();

  const state = createStateToken();

  oauthServer = http.createServer(
    async (request, response) => {
      try {
        const requestUrl =
          new URL(
            request.url,
            OAUTH_REDIRECT
          );

        if (
          requestUrl.pathname !==
          "/oauth2callback"
        ) {
          response.writeHead(404);
          response.end("Not found.");
          return;
        }

        const receivedState =
          requestUrl.searchParams.get(
            "state"
          );

        const code =
          requestUrl.searchParams.get(
            "code"
          );

        const error =
          requestUrl.searchParams.get(
            "error"
          );

        if (
          receivedState !== state
        ) {
          response.writeHead(400);
          response.end(
            "Invalid OAuth state."
          );
          return;
        }

        if (error) {
          response.writeHead(400);
          response.end(
            `Google OAuth failed: ${error}`
          );

          sendTelemetry({
            timestamp:
              new Date().toISOString(),
            level: "error",
            message:
              `Google OAuth failed: ${error}`
          });

          return;
        }

        if (!code) {
          response.writeHead(400);
          response.end(
            "No authorization code was received."
          );
          return;
        }

        const { tokens } =
          await oauthClient.getToken(
            code
          );

        oauthClient.setCredentials(
          tokens
        );

        const tokenInfo =
          await oauthClient.getTokenInfo(
            tokens.access_token
          );

        const email =
          tokenInfo.email;

        if (!email) {
          throw new Error(
            "Google did not return an email address."
          );
        }

        const existing =
          getAccounts().find(
            (account) =>
              account.email.toLowerCase() ===
              email.toLowerCase()
          );

        const existingCredentials =
          existing
            ? (() => {
                const raw = require("./db")
                  .getAccountById(
                    existing.id
                  );

                return JSON.parse(
                  raw.credentials || "{}"
                );
              })()
            : {};

        const refreshToken =
          tokens.refresh_token ||
          existingCredentials.refreshToken;

        if (!refreshToken) {
          throw new Error(
            "Google did not provide a refresh token. Remove the LeadPulse authorization from your Google account and try again."
          );
        }

        const credentials = {
          clientId:
            process.env.GOOGLE_CLIENT_ID,
          clientSecret:
            process.env.GOOGLE_CLIENT_SECRET,
          refreshToken
        };

        createAccount({
          email,
          authType:
            "google_oauth",
          credentials,
          dailyLimit:
            existing?.daily_limit || 100
        });

        response.writeHead(200, {
          "Content-Type":
            "text/html; charset=utf-8"
        });

        response.end(`
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>LeadPulse</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  background: #020617;
                  color: #e2e8f0;
                  display: grid;
                  place-items: center;
                  height: 100vh;
                  margin: 0;
                }
                .box {
                  text-align: center;
                  padding: 40px;
                }
                h1 {
                  color: #2dd4bf;
                }
              </style>
            </head>
            <body>
              <div class="box">
                <h1>LeadPulse connected</h1>
                <p>You can close this browser window and return to LeadPulse.</p>
              </div>
            </body>
          </html>
        `);

        sendTelemetry({
          timestamp:
            new Date().toISOString(),
          level: "success",
          message:
            `Google account connected: ${email}`
        });

        if (
          mainWindow &&
          !mainWindow.isDestroyed()
        ) {
          mainWindow.webContents.send(
            "oauth-complete"
          );
        }

        setTimeout(() => {
          if (oauthServer) {
            oauthServer.close();
            oauthServer = null;
          }
        }, 1000);
      } catch (oauthError) {
        response.writeHead(500, {
          "Content-Type":
            "text/plain; charset=utf-8"
        });

        response.end(
          `LeadPulse OAuth error: ${oauthError.message}`
        );

        sendTelemetry({
          timestamp:
            new Date().toISOString(),
          level: "error",
          message:
            `Google OAuth error: ${oauthError.message}`
        });
      }
    }
  );

  await new Promise(
    (resolve, reject) => {
      oauthServer.once(
        "error",
        reject
      );

      oauthServer.listen(
        OAUTH_PORT,
        "127.0.0.1",
        resolve
      );
    }
  );

  const authUrl =
    oauthClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.send"
      ],
      state
    });

  await shell.openExternal(
    authUrl
  );

  sendTelemetry({
    timestamp:
      new Date().toISOString(),
    level: "info",
    message:
      "Google OAuth browser authorization opened."
  });

  return {
    started: true,
    redirectUri: OAUTH_REDIRECT
  };
}

function registerIpcHandlers() {
  ipcMain.handle(
    "accounts:list",
    () => getAccounts()
  );
    ipcMain.handle(
    "whatsapp:connect",
    async () => {
      try {
        const result =
          await initializeWhatsApp();

        sendTelemetry({
          timestamp:
            new Date().toISOString(),
          level: "info",
          message:
            "WhatsApp connection initialization started."
        });

        return result;
      } catch (error) {
        console.error(
          "WhatsApp connection error:",
          error
        );

        sendTelemetry({
          timestamp:
            new Date().toISOString(),
          level: "error",
          message:
            `WhatsApp connection failed: ${error.message}`
        });

        throw new Error(
          error?.message ||
            "Failed to initialize WhatsApp connection."
        );
      }
    }
  );

  ipcMain.handle(
    "whatsapp:disconnect",
    async () => {
      await disconnectWhatsApp();

      sendTelemetry({
        timestamp:
          new Date().toISOString(),
        level: "info",
        message:
          "WhatsApp disconnected."
      });

      return {
        success: true
      };
    }
  );

  ipcMain.handle(
    "whatsapp:get-state",
    () => {
      return getState();
    }
  );

  ipcMain.handle(
    "whatsapp:get-contacts",
    async () => {
      return await getContacts();
    }
  );
  ipcMain.handle(
    "accounts:add-smtp",
    (_event, payload) => {
      const email =
        String(payload?.email || "")
          .trim()
          .toLowerCase();

      const host =
        String(payload?.host || "").trim();

      const port =
        Number(payload?.port);

      const username =
        String(
          payload?.username || ""
        ).trim();

      const password =
        String(
          payload?.password || ""
        );

      const secure =
        Boolean(payload?.secure);

      const dailyLimit =
        Math.max(
          1,
          Math.min(
            1000,
            Number(
              payload?.dailyLimit
            ) || 100
          )
        );

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        throw new Error(
          "Enter a valid email address."
        );
      }

      if (!host) {
        throw new Error(
          "SMTP host is required."
        );
      }

      if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
      ) {
        throw new Error(
          "SMTP port must be between 1 and 65535."
        );
      }

      if (!username || !password) {
        throw new Error(
          "SMTP username and password are required."
        );
      }

      const account =
        createAccount({
          email,
          authType: "smtp",
          credentials: {
            host,
            port,
            username,
            password,
            secure
          },
          dailyLimit
        });

      sendTelemetry({
        timestamp:
          new Date().toISOString(),
        level: "success",
        message:
          `SMTP account connected: ${email}`
      });

      return {
        id: account.id,
        email: account.email,
        auth_type:
          account.auth_type,
        daily_limit:
          account.daily_limit,
        sent_today:
          account.sent_today
      };
    }
  );

  ipcMain.handle(
    "accounts:remove",
    (_event, accountId) => {
      const removed =
        removeAccount(
          Number(accountId)
        );

      if (removed) {
        sendTelemetry({
          timestamp:
            new Date().toISOString(),
          level: "info",
          message:
            `Account #${accountId} removed.`
        });
      }

      return removed;
    }
  );

  ipcMain.handle(
    "oauth:start-google",
    async () =>
      startGoogleOAuth()
  );

  ipcMain.handle(
    "campaigns:list",
    () => getCampaigns()
  );

  ipcMain.handle(
    "campaigns:logs",
    (_event, campaignId) =>
      getCampaignLogs(
        Number(campaignId)
      )
  );

  ipcMain.handle(
    "spam:analyze",
    (_event, subject, body) =>
      analyzeSpam(
        subject || "",
        body || ""
      )
  );

  ipcMain.handle(
    "campaigns:launch",
    async (_event, payload) => {
      return launchCampaign({
        recipients:
          payload?.recipients || "",
        subject:
          payload?.subject || "",
        body:
          payload?.body || "",
        delaySeconds:
          payload?.delaySeconds || 7,
        emit: sendTelemetry
      });
    }
  );
}

app.whenReady().then(() => {
  initializeDatabase(
    app.getPath("userData")
  );

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (
      BrowserWindow.getAllWindows()
        .length === 0
    ) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (oauthServer) {
    try {
      oauthServer.close();
    } catch {
      // Ignore OAuth callback server cleanup errors.
    }

    oauthServer = null;
  }

  try {
    require("./db").closeDatabase();
  } catch {
    // Database may already be closed.
  }
});
