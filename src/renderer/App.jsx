import React, {
  useEffect,
  useMemo,
  useState
} from "react";
import { api } from "../api/api";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Gauge,
  History,
  LayoutDashboard,
  Mail,
  MailCheck,
  Menu,
  Plus,
  RefreshCw,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
  MessageCircle,
  Zap,
  Building2,
  Search,
  MapPin,
  Filter,
  Phone,
  Globe
} from "lucide-react";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard
  },
  {
  id: "leads",
  label: "Leads",
  icon: Building2
},
  {
    id: "composer",
    label: "Campaign Composer",
    icon: Send
  },
  {
    id: "telemetry",
    label: "Live Telemetry",
    icon: Activity
  },
  {
    id: "history",
    label: "History",
    icon: History
  }
];

const INITIAL_LOGS = [
  {
    timestamp: new Date().toISOString(),
    level: "info",
    message:
      "LeadPulse engine initialized."
  }
];

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatTime(value) {
  if (!value) {
    return "--:--:--";
  }

  return new Date(value).toLocaleTimeString(
    [],
    {
      hour12: false
    }
  );
}

function cn(...classes) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function App() {
  const [activeView, setActiveView] =
    useState("dashboard");

  const [accounts, setAccounts] =
    useState([]);
  const [whatsappState, setWhatsappState] =
  useState({
    status: "disconnected",
    account: null
  });
  const [leads, setLeads] = useState([]);
const [leadTotal, setLeadTotal] = useState(0);
const [leadLoading, setLeadLoading] = useState(false);

const [leadFilters, setLeadFilters] = useState({
  q: "",
  city: "",
  category: "",
  has_phone: "",
  has_email: ""
});
  const [campaigns, setCampaigns] =
    useState([]);

  const [telemetry, setTelemetry] =
    useState(INITIAL_LOGS);

  const [smtpModal, setSmtpModal] =
    useState(false);

  const [launching, setLaunching] =
    useState(false);

  const [toast, setToast] =
    useState(null);

  const [sidebarOpen, setSidebarOpen] =
    useState(true);

  const [composer, setComposer] =
    useState({
      recipients: "",
      subject: "",
      body: "",
      delaySeconds: 7
    });

  const [spamResult, setSpamResult] =
    useState({
      score: 100,
      label: "100% SPAM SAFE",
      flaggedWords: [],
      metrics: {}
    });

  const loadAccounts = async () => {
  try {
    const data = await api.accounts.list();

    setAccounts(data);
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
};

  const loadCampaigns = async () => {
    try {
      const data =
        await api.campaigns.list();

      setCampaigns(data);
    } catch (error) {
      showToast(
        error.message,
        "error"
      );
    }
  };
  const loadLeads = async () => {
  setLeadLoading(true);

  try {
    const data = await api.leads.list(leadFilters);

    setLeads(data.leads || []);
    setLeadTotal(data.total || 0);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setLeadLoading(false);
  }
};
 const loadWhatsAppState = async () => {
  try {
    const data =
      await api.whatsapp.getState();

    setWhatsappState(data);
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
};
  useEffect(() => {
  loadAccounts();
  loadCampaigns();
  loadWhatsAppState();
}, []);
  
  // Load initial application data
  useEffect(() => {
    loadAccounts();
    loadCampaigns();
    loadWhatsAppState();
  }, []);

  // Load leads when the Leads page is opened or filters change
  useEffect(() => {
    if (activeView === "leads") {
      loadLeads();
    }
  }, [activeView, leadFilters]);

  // Existing spam analyzer
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        if (!window.leadPulse?.spam?.analyze) {
          return;
        }

        const result = await window.leadPulse.spam.analyze(
          composer.subject,
          composer.body
        );

        setSpamResult(result);
      } catch (error) {
        console.error("Spam analysis unavailable:", error);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [composer.subject, composer.body]);

  function showToast(
    message,
    type = "info"
  ) {
    setToast({
      message,
      type
    });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  async function connectGoogle() {
    try {
      await window.leadPulse.accounts.startGoogleOAuth();

      showToast(
        "Google authorization opened in your browser.",
        "info"
      );
    } catch (error) {
      showToast(
        error.message,
        "error"
      );
    }
  }
  async function connectWhatsApp() {
  try {
    const result =
      await window.leadPulse.whatsapp.connect();

    setWhatsappState((previous) => ({
      ...previous,
      status:
        result.status || "connecting",
      account:
        result.account || previous.account
    }));

    showToast(
      "WhatsApp connection started.",
      "info"
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function disconnectWhatsApp() {
  try {
    await window.leadPulse.whatsapp.disconnect();

    setWhatsappState({
      status: "disconnected",
      account: null
    });

    showToast(
      "WhatsApp disconnected.",
      "success"
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
  async function removeAccount(
    account
  ) {
    const confirmed =
      window.confirm(
        `Remove ${account.email} from LeadPulse?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await window.leadPulse.accounts.remove(
        account.id
      );

      await loadAccounts();

      showToast(
        "Account removed.",
        "success"
      );
    } catch (error) {
      showToast(
        error.message,
        "error"
      );
    }
  }

  async function launchCampaign() {
    if (launching) {
      return;
    }

    if (!composer.recipients.trim()) {
      showToast(
        "Add at least one recipient.",
        "error"
      );
      return;
    }

    if (!composer.subject.trim()) {
      showToast(
        "Add a subject line.",
        "error"
      );
      return;
    }

    if (!composer.body.trim()) {
      showToast(
        "Add an email body.",
        "error"
      );
      return;
    }

    if (spamResult.score < 50) {
      const proceed =
        window.confirm(
          "The spam analyzer marked this message high risk. Continue anyway?"
        );

      if (!proceed) {
        return;
      }
    }

    setLaunching(true);
    setActiveView("telemetry");

    try {
      const result =
        await window.leadPulse.campaigns.launch(
          composer
        );

      await loadAccounts();
      await loadCampaigns();

      showToast(
        `Campaign finished: ${result.successful} sent, ${result.failed} failed.`,
        result.failed > 0
          ? "info"
          : "success"
      );
    } catch (error) {
      showToast(
        error.message,
        "error"
      );
    } finally {
      setLaunching(false);
    }
  }

  function insertMergeTag(tag) {
    setComposer((previous) => ({
      ...previous,
      body:
        previous.body +
        `${previous.body ? " " : ""}${tag}`
    }));
  }

  const totalSent = useMemo(
    () =>
      accounts.reduce(
        (sum, account) =>
          sum +
          Number(
            account.sent_today || 0
          ),
        0
      ),
    [accounts]
  );

  const totalQuota = useMemo(
    () =>
      accounts.reduce(
        (sum, account) =>
          sum +
          Number(
            account.daily_limit || 0
          ),
        0
      ),
    [accounts]
  );

  const activeAccounts =
    accounts.filter(
      (account) =>
        Number(account.sent_today) <
        Number(account.daily_limit)
    ).length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {sidebarOpen && (
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          accounts={accounts}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setSidebarOpen(
                  (value) => !value
                )
              }
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 className="text-sm font-semibold text-white">
                {NAV_ITEMS.find(
                  (item) =>
                    item.id === activeView
                )?.label}
              </h1>

              <p className="text-xs text-slate-500">
                Local outreach workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 sm:flex">
              <span className="h-2 w-2 rounded-full bg-teal-400" />
              Engine online
            </div>

            <button
              onClick={() => {
                loadAccounts();
                loadCampaigns();
              }}
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeView === "dashboard" && (
            <Dashboard
              accounts={accounts}
              whatsappState={whatsappState}
              connectWhatsApp={connectWhatsApp}
              disconnectWhatsApp={disconnectWhatsApp}
              totalSent={totalSent}
              totalQuota={totalQuota}
              activeAccounts={
                activeAccounts
              }
              connectGoogle={
                connectGoogle
              }
              openSmtp={() =>
                setSmtpModal(true)
              }
              removeAccount={
                removeAccount
              }
            />
          )}
          {activeView === "leads" && (
  <LeadsView
    leads={leads}
    total={leadTotal}
    loading={leadLoading}
    filters={leadFilters}
    setFilters={setLeadFilters}
    refresh={loadLeads}
  />
)}

          {activeView === "composer" && (
            <Composer
              composer={composer}
              setComposer={setComposer}
              spamResult={spamResult}
              insertMergeTag={
                insertMergeTag
              }
              launchCampaign={
                launchCampaign
              }
              launching={launching}
              accounts={accounts}
            />
          )}

          {activeView === "telemetry" && (
            <Telemetry
              logs={telemetry}
              clearLogs={() =>
                setTelemetry([])
              }
            />
          )}

          {activeView === "history" && (
            <HistoryView
              campaigns={campaigns}
              loadCampaigns={
                loadCampaigns
              }
            />
          )}
        </div>
      </main>

      {smtpModal && (
        <SmtpModal
          close={() =>
            setSmtpModal(false)
          }
          onSaved={async () => {
            setSmtpModal(false);
            await loadAccounts();

            showToast(
              "SMTP account connected.",
              "success"
            );
          }}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast
          toast={toast}
          close={() =>
            setToast(null)
          }
        />
      )}
    </div>
  );
}

function Sidebar({
  activeView,
  setActiveView,
  accounts
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-400/20">
          <Zap
            size={19}
            className="text-teal-400"
          />
        </div>

        <div>
          <div className="text-sm font-bold tracking-wide text-white">
            LeadPulse
          </div>

          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            v1.0.0 Beta
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected =
            activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() =>
                setActiveView(item.id)
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                selected
                  ? "bg-teal-500/10 text-teal-300 ring-1 ring-teal-400/10"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>

              {selected && (
                <ChevronRight
                  size={14}
                  className="ml-auto"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Database
              size={15}
              className="text-teal-400"
            />

            <span className="text-xs font-medium text-slate-300">
              Local storage
            </span>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">
            SQLite database and campaign
            records are stored locally on
            this computer.
          </p>

          <div className="mt-3 text-xs text-slate-500">
            {accounts.length} sender
            {accounts.length === 1
              ? ""
              : "s"} connected
          </div>
        </div>
      </div>
    </aside>
  );
}

function Dashboard({
  accounts,
  whatsappState,
  connectWhatsApp,
  disconnectWhatsApp,
  totalSent,
  totalQuota,
  activeAccounts,
  connectGoogle,
  openSmtp,
  removeAccount
}) {
  return (
    <section className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-teal-400">
            <Gauge size={14} />
            Overview
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white">
            Sender dashboard
          </h2>

          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Manage local sending accounts,
            quotas, and campaign readiness.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={connectGoogle}
            className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
          >
            <Mail size={17} />
            Sign in with Google
          </button>

          <button
            onClick={openSmtp}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
          >
            <Plus size={17} />
            Add SMTP
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Mail}
          label="Connected accounts"
          value={accounts.length}
          detail={`${activeAccounts} with available quota`}
        />

        <StatCard
          icon={MailCheck}
          label="Sent today"
          value={totalSent}
          detail={`of ${totalQuota || 0} total quota`}
        />

        <StatCard
          icon={ShieldCheck}
          label="Sender health"
          value={
            accounts.length > 0
              ? "Ready"
              : "Setup"
          }
          detail={
            accounts.length > 0
              ? "Accounts available"
              : "Connect a sender"
          }
        />

        <StatCard
          icon={Activity}
          label="Rotation"
          value={
            accounts.length > 1
              ? "Active"
              : "Single"
          }
          detail="Round-robin strategy"
        />
      </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-400/10">
              <MessageCircle size={20} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                WhatsApp Business
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Connect your business WhatsApp account to LeadPulse.
              </p>
            </div>
          </div>

          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
              whatsappState.status === "connected"
                ? "bg-emerald-500/10 text-emerald-400"
                : whatsappState.status === "connecting"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-slate-800 text-slate-500"
            )}
          >
            {whatsappState.status}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {whatsappState.status === "connected"
              ? `Connected${whatsappState.account?.name ? ` as ${whatsappState.account.name}` : ""}`
              : "No WhatsApp Business account connected."}
          </div>

          {whatsappState.status === "connected" ? (
            <button
              onClick={disconnectWhatsApp}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connectWhatsApp}
              disabled={whatsappState.status === "connecting"}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle size={15} />
              {whatsappState.status === "connecting"
                ? "Connecting..."
                : "Connect WhatsApp"}
            </button>
          )}
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Sending accounts
            </h3>

            <p className="text-xs text-slate-500">
              Each account has an independent
              daily quota.
            </p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <EmptyAccounts
            connectGoogle={connectGoogle}
            openSmtp={openSmtp}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                removeAccount={
                  removeAccount
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={19}
            className="mt-0.5 shrink-0 text-teal-400"
          />

          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Responsible sending
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Use only lawful, permission-based,
              or otherwise legitimately addressed
              business communications. Respect
              provider policies, recipient
              preferences, and applicable
              anti-spam requirements.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-glow">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-teal-400">
          <Icon size={18} />
        </div>

        <BarChart3
          size={15}
          className="text-slate-700"
        />
      </div>

      <div className="mt-5 text-2xl font-bold text-white">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-[11px] text-slate-600">
        {detail}
      </div>
    </div>
  );
}

function EmptyAccounts({
  connectGoogle,
  openSmtp
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
        <UserPlus
          size={21}
          className="text-teal-400"
        />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-white">
        No sender accounts
      </h3>

      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        Connect Gmail through OAuth or add a
        custom SMTP account to start building
        campaigns.
      </p>

      <div className="mt-5 flex justify-center gap-2">
        <button
          onClick={connectGoogle}
          className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400"
        >
          Connect Google
        </button>

        <button
          onClick={openSmtp}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          Add SMTP
        </button>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  removeAccount
}) {
  const used =
    Number(account.sent_today) || 0;

  const limit =
    Number(account.daily_limit) || 100;

  const percentage = Math.min(
    100,
    Math.round((used / limit) * 100)
  );

  const exhausted =
    used >= limit;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 ring-1 ring-teal-400/10">
            {account.auth_type ===
            "google_oauth" ? (
              <Mail size={19} />
            ) : (
              <Server size={19} />
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {account.email}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {account.auth_type ===
                "google_oauth"
                  ? "Gmail"
                  : "SMTP"}
              </span>

              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() =>
            removeAccount(account)
          }
          className="rounded-lg p-2 text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
          title="Remove account"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Daily quota
          </span>

          <span
            className={cn(
              "font-medium",
              exhausted
                ? "text-amber-400"
                : "text-slate-300"
            )}
          >
            {used}/{limit} Used
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              exhausted
                ? "bg-amber-500"
                : "bg-teal-500"
            )}
            style={{
              width: `${percentage}%`
            }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[10px] text-slate-600">
          <span>
            {percentage}% utilized
          </span>

          <span>
            Reset: daily
          </span>
        </div>
      </div>
    </div>
  );
}

function Composer({
  composer,
  setComposer,
  spamResult,
  insertMergeTag,
  launchCampaign,
  launching,
  accounts
}) {
  const recipientCount =
    composer.recipients
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean).length;

  return (
    <section className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-teal-400">
          <Send size={14} />
          Campaign
        </div>

        <h2 className="text-2xl font-bold text-white">
          Compose campaign
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Build the message, review its heuristic
          spam score, then dispatch it through
          the connected sender pool.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-5">
          <Panel title="Recipients">
            <textarea
              value={composer.recipients}
              onChange={(event) =>
                setComposer({
                  ...composer,
                  recipients:
                    event.target.value
                })
              }
              rows={7}
              placeholder={
                "recipient@example.com\nanother@example.com"
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-teal-500/60"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
              <span>
                One address per line, comma, or
                semicolon.
              </span>

              <span>
                {recipientCount} recipient
                {recipientCount === 1
                  ? ""
                  : "s"}
              </span>
            </div>
          </Panel>

          <Panel title="Message">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Subject
                </label>

                <input
                  value={composer.subject}
                  onChange={(event) =>
                    setComposer({
                      ...composer,
                      subject:
                        event.target.value
                    })
                  }
                  placeholder="A concise business subject"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-teal-500/60"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Body
                  </label>

                  <span className="text-[10px] text-slate-600">
                    Plain text
                  </span>
                </div>

                <textarea
                  value={composer.body}
                  onChange={(event) =>
                    setComposer({
                      ...composer,
                      body:
                        event.target.value
                    })
                  }
                  rows={14}
                  placeholder={
                    "Hi {first_name},\n\nI wanted to reach out regarding..."
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-teal-500/60"
                />

                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    "{first_name}",
                    "{company_name}",
                    "{industry}"
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        insertMergeTag(
                          tag
                        )
                      }
                      className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-teal-400 transition hover:border-teal-500/30 hover:bg-teal-500/5"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Dispatch configuration">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Sender strategy
                </label>

                <select
                  value="rotation"
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 outline-none"
                >
                  <option value="rotation">
                    Multi-Account Rotation
                  </option>
                </select>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Delay between sends
                  </label>

                  <span className="text-xs font-semibold text-teal-400">
                    {composer.delaySeconds}s
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="60"
                  value={
                    composer.delaySeconds
                  }
                  onChange={(event) =>
                    setComposer({
                      ...composer,
                      delaySeconds:
                        Number(
                          event.target.value
                        )
                    })
                  }
                  className="mt-2 w-full"
                />

                <div className="mt-1 flex justify-between text-[10px] text-slate-600">
                  <span>0s</span>
                  <span>60s</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-center gap-2">
                <Settings2
                  size={15}
                  className="text-teal-400"
                />

                <span className="text-xs font-medium text-slate-300">
                  Rotation pool
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {accounts.length > 0
                  ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} available. Accounts at their daily quota are skipped automatically.`
                  : "Connect at least one sender account before launching."}
              </p>
            </div>
          </Panel>

          <button
            disabled={
              launching ||
              accounts.length === 0
            }
            onClick={launchCampaign}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
          >
            {launching ? (
              <>
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
                Campaign running...
              </>
            ) : (
              <>
                <Send size={17} />
                Launch Email Campaign
              </>
            )}
          </button>
        </div>

        <SpamAnalyzer result={spamResult} />
      </div>
    </section>
  );
}

function Panel({
  title,
  children
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {title}
        </h3>
      </div>

      {children}
    </div>
  );
}

function SpamAnalyzer({ result }) {
  const score = Number(
    result.score || 0
  );

  const scoreClass =
    score >= 90
      ? "text-emerald-400"
      : score >= 75
        ? "text-teal-400"
        : score >= 50
          ? "text-amber-400"
          : "text-red-400";

  return (
    <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-5 xl:sticky xl:top-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={17}
              className="text-teal-400"
            />

            <h3 className="text-sm font-semibold text-white">
              Spam Analyzer
            </h3>
          </div>

          <p className="mt-1 text-[11px] text-slate-600">
            Heuristic content screening
          </p>
        </div>

        <span
          className={cn(
            "rounded-full bg-slate-950 px-2 py-1 text-[10px] font-bold",
            scoreClass
          )}
        >
          LIVE
        </span>
      </div>

      <div className="mt-7 flex flex-col items-center">
        <div
          className={cn(
            "text-4xl font-bold tracking-tight",
            scoreClass
          )}
        >
          {score}%
        </div>

        <div
          className={cn(
            "mt-1 text-xs font-semibold",
            scoreClass
          )}
        >
          {result.label}
        </div>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 90
              ? "bg-emerald-500"
              : score >= 75
                ? "bg-teal-500"
                : score >= 50
                  ? "bg-amber-500"
                  : "bg-red-500"
          )}
          style={{
            width: `${score}%`
          }}
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            Flagged triggers
          </span>

          <span className="text-xs text-slate-600">
            {result.flaggedWords
              ?.length || 0}
          </span>
        </div>

        {result.flaggedWords?.length >
        0 ? (
          <div className="space-y-2">
            {result.flaggedWords.map(
              (item) => (
                <div
                  key={item.word}
                  className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-amber-300">
                      {item.word}
                    </span>

                    <span className="text-[10px] text-slate-600">
                      review
                    </span>
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500">
                    Suggested:{" "}
                    <span className="text-slate-400">
                      {item.suggestion}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <CheckCircle2 size={15} />
              No configured trigger words found.
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
              This is a heuristic check, not a
              guarantee of inbox placement.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Metric
          label="Subject"
          value={
            result.metrics?.subjectLength ||
            0
          }
        />

        <Metric
          label="Body"
          value={
            result.metrics?.bodyLength ||
            0
          }
        />
      </div>
    </aside>
  );
}

function Metric({
  label,
  value
}) {
  return (
    <div className="rounded-xl bg-slate-950 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-600">
        {label}
      </div>

      <div className="mt-1 text-xs font-semibold text-slate-300">
        {value} chars
      </div>
    </div>
  );
}

function Telemetry({
  logs,
  clearLogs
}) {
  return (
    <section className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-5 flex shrink-0 items-end justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-teal-400">
            <Activity size={14} />
            Runtime
          </div>

          <h2 className="text-2xl font-bold text-white">
            Live telemetry
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Dispatch, rotation, delay, and
            delivery events.
          </p>
        </div>

        <button
          onClick={clearLogs}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          Clear console
        </button>
      </div>

      <div className="terminal-scroll min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-black/60 p-4 font-mono shadow-glow">
        {logs.length === 0 ? (
          <div className="text-xs text-slate-700">
            Console cleared.
          </div>
        ) : (
          logs.map((log, index) => (
            <TelemetryLine
              key={`${log.timestamp}-${index}`}
              log={log}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TelemetryLine({ log }) {
  const levelClass =
    log.level === "error"
      ? "text-red-400"
      : log.level === "success" ||
          log.level === "complete"
        ? "text-emerald-400"
        : log.level === "rotation"
          ? "text-cyan-400"
          : log.level === "delay"
            ? "text-amber-400"
            : log.level === "queue"
              ? "text-violet-400"
              : "text-slate-400";

  return (
    <div className="group flex gap-3 py-1 text-[11px] leading-relaxed">
      <span className="shrink-0 text-slate-700">
        {formatTime(log.timestamp)}
      </span>

      <span
        className={cn(
          "w-20 shrink-0 uppercase",
          levelClass
        )}
      >
        [{log.level}]
      </span>

      <span
        className={cn(
          "break-all",
          levelClass
        )}
      >
        {log.message}
      </span>
    </div>
  );
}

function HistoryView({
  campaigns,
  loadCampaigns
}) {
  return (
    <section className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-teal-400">
            <History size={14} />
            Records
          </div>

          <h2 className="text-2xl font-bold text-white">
            Campaign history
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Local campaign and delivery records.
          </p>
        </div>

        <button
          onClick={loadCampaigns}
          className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Refresh history"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-left">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Campaign
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Created
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Recipients
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Delivered
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Failed
                </th>

                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-16 text-center text-xs text-slate-600"
                  >
                    No campaigns have been
                    launched yet.
                  </td>
                </tr>
              ) : (
                campaigns.map(
                  (campaign) => (
                    <tr
                      key={campaign.id}
                      className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/20"
                    >
                      <td className="max-w-[320px] px-4 py-4">
                        <div className="truncate text-xs font-medium text-slate-200">
                          {campaign.subject}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-600">
                          Campaign #{campaign.id}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                        {formatDate(
                          campaign.created_at
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-400">
                        {
                          campaign.total_recipients
                        }
                      </td>

                      <td className="px-4 py-4 text-xs text-emerald-400">
                        {
                          campaign.sent_count
                        }
                      </td>

                      <td className="px-4 py-4 text-xs text-red-400">
                        {
                          campaign.failed_count
                        }
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge
                          status={
                            campaign.status
                          }
                        />
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const normalized =
    String(status || "").toLowerCase();

  const style =
    normalized === "completed"
      ? "bg-emerald-500/10 text-emerald-400"
      : normalized ===
          "completed_with_errors"
        ? "bg-amber-500/10 text-amber-400"
        : normalized === "failed"
          ? "bg-red-500/10 text-red-400"
          : "bg-teal-500/10 text-teal-400";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-[10px] font-semibold",
        style
      )}
    >
      {String(status || "unknown").replace(
        /_/g,
        " "
      )}
    </span>
  );
}

function SmtpModal({
  close,
  onSaved,
  showToast
}) {
  const [form, setForm] =
    useState({
      email: "",
      host: "",
      port: 587,
      username: "",
      password: "",
      secure: false,
      dailyLimit: 100
    });

  const [saving, setSaving] =
    useState(false);

  async function submit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await window.leadPulse.accounts.addSmtp(
        form
      );

      await onSaved();
    } catch (error) {
      showToast(
        error.message,
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Add custom SMTP
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Credentials are stored in the local
              LeadPulse database.
            </p>
          </div>

          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 p-5"
        >
          <Field
            label="Email address"
            value={form.email}
            onChange={(value) =>
              update("email", value)
            }
            type="email"
            placeholder="sender@example.com"
          />

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field
              label="SMTP host"
              value={form.host}
              onChange={(value) =>
                update("host", value)
              }
              placeholder="smtp.example.com"
            />

            <Field
              label="Port"
              value={form.port}
              onChange={(value) =>
                update(
                  "port",
                  Number(value)
                )
              }
              type="number"
              min="1"
              max="65535"
            />
          </div>

          <Field
            label="Username"
            value={form.username}
            onChange={(value) =>
              update(
                "username",
                value
              )
            }
            placeholder="SMTP username"
          />

          <Field
            label="Password"
            value={form.password}
            onChange={(value) =>
              update(
                "password",
                value
              )
            }
            type="password"
            placeholder="SMTP password"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.secure}
                  onChange={(event) =>
                    update(
                      "secure",
                      event.target.checked
                    )
                  }
                  className="h-4 w-4 accent-teal-500"
                />

                <span>
                  <span className="block text-xs font-medium text-slate-300">
                    Secure TLS
                  </span>

                  <span className="block text-[10px] text-slate-600">
                    Usually enabled for port 465.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Daily limit
              </label>

              <input
                type="number"
                min="1"
                max="1000"
                value={form.dailyLimit}
                onChange={(event) =>
                  update(
                    "dailyLimit",
                    Number(
                      event.target.value
                    )
                  )
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-teal-500/60"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
            >
              {saving && (
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
              )}

              Connect SMTP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-teal-500/60"
      />
    </div>
  );
}

function Toast({
  toast,
  close
}) {
  const isError =
    toast.type === "error";

  return (
    <div className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
      <div className="flex items-start gap-3">
        {isError ? (
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0 text-red-400"
          />
        ) : (
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0 text-teal-400"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-200">
            {toast.message}
          </div>
        </div>

        <button
          onClick={close}
          className="text-slate-600 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function LeadsView({
  leads,
  total,
  loading,
  filters,
  setFilters,
  refresh
}) {
  function updateFilter(field, value) {
    setFilters(previous => ({
      ...previous,
      [field]: value
    }));
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-teal-400">
            <Building2 size={15} />
            Lead database
          </div>

          <h2 className="text-2xl font-bold text-white">
            Business leads
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Search and manage businesses stored in PostgreSQL.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh leads
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500">Total matching leads</div>
          <div className="mt-2 text-2xl font-bold text-white">{total}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500">With phone numbers</div>
          <div className="mt-2 text-2xl font-bold text-white">
            {leads.filter(lead => lead.phone).length}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500">With email addresses</div>
          <div className="mt-2 text-2xl font-bold text-white">
            {leads.filter(lead => lead.email).length}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-500">Current results</div>
          <div className="mt-2 text-2xl font-bold text-teal-400">
            {leads.length}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={16} className="text-teal-400" />
          <h3 className="text-sm font-semibold text-white">Search filters</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={filters.q}
            onChange={e => updateFilter("q", e.target.value)}
            placeholder="Business or contact..."
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500"
          />

          <input
            value={filters.city}
            onChange={e => updateFilter("city", e.target.value)}
            placeholder="City..."
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500"
          />

          <input
            value={filters.category}
            onChange={e => updateFilter("category", e.target.value)}
            placeholder="Category..."
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500"
          />

          <select
            value={filters.has_phone}
            onChange={e => updateFilter("has_phone", e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none"
          >
            <option value="">Any phone status</option>
            <option value="true">Has phone</option>
            <option value="false">No phone</option>
          </select>

          <select
            value={filters.has_email}
            onChange={e => updateFilter("has_email", e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none"
          >
            <option value="">Any email status</option>
            <option value="true">Has email</option>
            <option value="false">No email</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">
            Stored businesses
          </h3>
          <span className="text-xs text-slate-500">
            {total} results
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-left">
                {["Business", "Category", "Location", "Phone", "Email", "Source"].map(item => (
                  <th key={item} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {item}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-xs text-slate-500">
                    Loading leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-xs text-slate-500">
                    No matching businesses found.
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-800/70 last:border-0 hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-4">
                      <div className="text-xs font-semibold text-white">
                        {lead.business_name}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        ID #{lead.id}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-400">
                      {lead.category || "—"}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-400">
                      {lead.city || lead.address || "—"}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-300">
                      {lead.phone || "—"}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-300">
                      {lead.email || "—"}
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-500">
                      {lead.source || "Manual"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default App;