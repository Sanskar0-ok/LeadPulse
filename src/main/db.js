const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let db = null;

function getDatabasePath(userDataPath) {
  const directory = path.join(userDataPath, "LeadPulse");

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }

  return path.join(directory, "leadpulse.sqlite");
}

function initializeDatabase(userDataPath) {
  if (db) {
    return db;
  }

  const databasePath = getDatabasePath(userDataPath);

  db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      auth_type TEXT NOT NULL CHECK(auth_type IN ('google_oauth', 'smtp')),
      credentials TEXT NOT NULL DEFAULT '{}',
      daily_limit INTEGER NOT NULL DEFAULT 100,
      sent_today INTEGER NOT NULL DEFAULT 0,
      last_reset TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      recipient TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign
      ON campaign_logs(campaign_id);

    CREATE INDEX IF NOT EXISTS idx_campaign_logs_timestamp
      ON campaign_logs(timestamp);
  `);

  resetDailyCounters();

  return db;
}

function requireDb() {
  if (!db) {
    throw new Error("Database has not been initialized.");
  }

  return db;
}

function todayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function resetDailyCounters() {
  const database = requireDb();
  const today = todayKey();

  database
    .prepare(`
      UPDATE accounts
      SET sent_today = 0,
          last_reset = ?
      WHERE last_reset IS NULL OR substr(last_reset, 1, 10) != ?
    `)
    .run(new Date().toISOString(), today);
}

function getAccounts() {
  resetDailyCounters();

  return requireDb()
    .prepare(`
      SELECT
        id,
        email,
        auth_type,
        daily_limit,
        sent_today,
        last_reset
      FROM accounts
      ORDER BY id ASC
    `)
    .all();
}

function getAccountById(id) {
  resetDailyCounters();

  return requireDb()
    .prepare(`
      SELECT *
      FROM accounts
      WHERE id = ?
    `)
    .get(id);
}

function getAccountByEmail(email) {
  resetDailyCounters();

  return requireDb()
    .prepare(`
      SELECT *
      FROM accounts
      WHERE lower(email) = lower(?)
    `)
    .get(email);
}

function getAccountsWithCredentials() {
  resetDailyCounters();

  return requireDb()
    .prepare(`
      SELECT *
      FROM accounts
      WHERE sent_today < daily_limit
      ORDER BY id ASC
    `)
    .all()
    .map((account) => ({
      ...account,
      credentials: JSON.parse(account.credentials || "{}")
    }));
}

function createAccount({
  email,
  authType,
  credentials,
  dailyLimit = 100
}) {
  const database = requireDb();

  const existing = getAccountByEmail(email);

  if (existing) {
    database
      .prepare(`
        UPDATE accounts
        SET auth_type = ?,
            credentials = ?,
            daily_limit = ?
        WHERE id = ?
      `)
      .run(
        authType,
        JSON.stringify(credentials || {}),
        Math.max(1, Number(dailyLimit) || 100),
        existing.id
      );

    return getAccountById(existing.id);
  }

  const result = database
    .prepare(`
      INSERT INTO accounts (
        email,
        auth_type,
        credentials,
        daily_limit,
        sent_today,
        last_reset
      )
      VALUES (?, ?, ?, ?, 0, ?)
    `)
    .run(
      email,
      authType,
      JSON.stringify(credentials || {}),
      Math.max(1, Number(dailyLimit) || 100),
      new Date().toISOString()
    );

  return getAccountById(result.lastInsertRowid);
}

function incrementAccountSentCount(accountId) {
  const database = requireDb();

  database
    .prepare(`
      UPDATE accounts
      SET sent_today = sent_today + 1
      WHERE id = ?
        AND sent_today < daily_limit
    `)
    .run(accountId);
}

function createCampaign(subject, body, status = "queued") {
  const database = requireDb();

  const result = database
    .prepare(`
      INSERT INTO campaigns (
        subject,
        body,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?)
    `)
    .run(
      subject,
      body,
      status,
      new Date().toISOString()
    );

  return result.lastInsertRowid;
}

function updateCampaignStatus(campaignId, status) {
  requireDb()
    .prepare(`
      UPDATE campaigns
      SET status = ?
      WHERE id = ?
    `)
    .run(status, campaignId);
}

function createCampaignLog({
  campaignId,
  recipient,
  senderEmail,
  status
}) {
  requireDb()
    .prepare(`
      INSERT INTO campaign_logs (
        campaign_id,
        recipient,
        sender_email,
        status,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      campaignId,
      recipient,
      senderEmail,
      status,
      new Date().toISOString()
    );
}

function getCampaigns() {
  const database = requireDb();

  return database
    .prepare(`
      SELECT
        c.id,
        c.subject,
        c.body,
        c.status,
        c.created_at,
        COUNT(cl.id) AS total_recipients,
        SUM(
          CASE
            WHEN cl.status = 'sent' THEN 1
            ELSE 0
          END
        ) AS sent_count,
        SUM(
          CASE
            WHEN cl.status = 'failed' THEN 1
            ELSE 0
          END
        ) AS failed_count
      FROM campaigns c
      LEFT JOIN campaign_logs cl
        ON cl.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `)
    .all()
    .map((campaign) => ({
      ...campaign,
      total_recipients: Number(campaign.total_recipients || 0),
      sent_count: Number(campaign.sent_count || 0),
      failed_count: Number(campaign.failed_count || 0)
    }));
}

function getCampaignLogs(campaignId) {
  return requireDb()
    .prepare(`
      SELECT
        id,
        recipient,
        sender_email,
        status,
        timestamp
      FROM campaign_logs
      WHERE campaign_id = ?
      ORDER BY timestamp ASC
    `)
    .all(campaignId);
}

function removeAccount(accountId) {
  const result = requireDb()
    .prepare(`
      DELETE FROM accounts
      WHERE id = ?
    `)
    .run(accountId);

  return result.changes > 0;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initializeDatabase,
  getAccounts,
  getAccountById,
  getAccountByEmail,
  getAccountsWithCredentials,
  createAccount,
  incrementAccountSentCount,
  createCampaign,
  updateCampaignStatus,
  createCampaignLog,
  getCampaigns,
  getCampaignLogs,
  removeAccount,
  closeDatabase
};