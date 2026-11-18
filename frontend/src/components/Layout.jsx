import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Database,
  ClipboardList,
  Stethoscope,
  FlaskConical,
  Pill,
  Receipt,
  LogOut,
  Activity,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Server,
} from "lucide-react";

const MENU_GROUPS = [
  {
    label: "UTAMA",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: [
          "ADMIN",
          "PENDAFTARAN",
          "DOKTER",
          "FARMASI",
          "LABORATORIUM",
          "KASIR",
        ],
      },
    ],
  },
  {
    label: "PELAYANAN MEDIS",
    items: [
      {
        to: "/pendaftaran",
        label: "Pendaftaran & Antrean",
        icon: ClipboardList,
        roles: ["ADMIN", "PENDAFTARAN"],
      },
      {
        to: "/pemeriksaan",
        label: "Pemeriksaan Dokter",
        icon: Stethoscope,
        roles: ["ADMIN", "DOKTER"],
      },
      {
        to: "/laboratorium",
        label: "Laboratorium",
        icon: FlaskConical,
        roles: ["ADMIN", "LABORATORIUM"],
      },
      {
        to: "/farmasi",
        label: "Farmasi & Resep",
        icon: Pill,
        roles: ["ADMIN", "FARMASI"],
      },
    ],
  },
  {
    label: "ADMINISTRASI & KASIR",
    items: [
      {
        to: "/billing",
        label: "Kasir & Billing",
        icon: Receipt,
        roles: ["ADMIN", "KASIR"],
      },
      {
        to: "/master",
        label: "Master Data",
        icon: Database,
        roles: ["ADMIN", "PENDAFTARAN"],
      },
    ],
  },
];

const PAGE_TITLES = {
  "/": {
    title: "Dashboard Operasional",
    subtitle: "Ringkasan kunjungan, pelayanan poliklinik & keuangan",
  },
  "/pendaftaran": {
    title: "Pendaftaran & Antrean",
    subtitle: "Registrasi pasien baru/lama dan penerbitan nomor antrean",
  },
  "/pemeriksaan": {
    title: "Pemeriksaan Medis (EMR)",
    subtitle: "Rekam medis elektronik, tindakan, order lab & resep",
  },
  "/laboratorium": {
    title: "Unit Laboratorium",
    subtitle: "Manajemen permintaan dan input hasil pemeriksaan penunjang",
  },
  "/farmasi": {
    title: "Instalasi Farmasi",
    subtitle: "Verifikasi resep elektronik dan penyerahan obat pasien",
  },
  "/billing": {
    title: "Kasir & Billing",
    subtitle: "Rincian tagihan terpadu, pelunasan & cetak kwitansi",
  },
  "/master": {
    title: "Master Data SIMRS",
    subtitle: "Pengelolaan data pasien, dokter, poliklinik, tindakan & obat",
  },
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.nama_lengkap || "US")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const currentHeader = PAGE_TITLES[location.pathname] || {
    title: "SIMRS Rawat Jalan",
    subtitle: "PT Inova Medika Solusindo",
  };

  const formattedDate = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="layout">
      <aside
        className="sidebar"
        style={{
          width: collapsed ? "76px" : "260px",
          padding: collapsed ? "1.25rem 0.65rem" : "1.25rem 1rem 1.25rem 0",
          borderRight: "1px solid #e2e8f0",
          transition: "all 0.2s ease",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* Tombol Toggle Melayang Tepat di Garis Batas Kanan Sidebar */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Perluas Menu" : "Ciutkan Menu"}
          style={{
            position: "absolute",
            right: "-13px",
            top: "24px",
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            zIndex: 30,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand / Logo */}
        <div
          className="sidebar-brand"
          style={{
            padding: collapsed
              ? "0.25rem 0 1.5rem 0"
              : "0.25rem 1rem 1.5rem 1.5rem",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <div className="brand-logo" style={{ flexShrink: 0 }}>
            <Activity size={20} />
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <div>INOVA MEDIKA</div>
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}
              >
                SIMRS Rawat Jalan
              </div>
            </div>
          )}
        </div>

        {/* Navigasi Menu */}
        <nav style={{ flex: 1 }}>
          {MENU_GROUPS.map((group) => {
            const visibleItems = group.items.filter((m) =>
              m.roles.includes(user?.role),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div
                key={group.label}
                style={{ marginBottom: collapsed ? "0.5rem" : 0 }}
              >
                {!collapsed ? (
                  <div className="nav-section-label">{group.label}</div>
                ) : (
                  <div
                    style={{
                      height: "1px",
                      background: "#e2e8f0",
                      margin: "0.5rem 0.6rem",
                    }}
                  />
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      title={collapsed ? item.label : ""}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? "active" : ""}`
                      }
                      style={
                        collapsed
                          ? {
                              justifyContent: "center",
                              padding: "0.75rem",
                              borderRadius: "12px",
                              marginBottom: "0.35rem",
                            }
                          : undefined
                      }
                    >
                      <Icon size={19} style={{ flexShrink: 0 }} />
                      {!collapsed && (
                        <span style={{ whiteSpace: "nowrap" }}>
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Tombol Logout */}
        <div
          style={{
            paddingLeft: collapsed ? 0 : "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Keluar Sesi" : ""}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: collapsed ? "0.7rem 0" : "0.65rem 0.9rem",
              borderRadius: "12px",
              border: "1px solid #fecdd3",
              background: "#fff1f2",
              color: "#be123c",
              fontWeight: 700,
              fontSize: "0.86rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#e11d48";
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.borderColor = "#e11d48";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff1f2";
              e.currentTarget.style.color = "#be123c";
              e.currentTarget.style.borderColor = "#fecdd3";
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Keluar Sesi</span>}
          </button>
        </div>
      </aside>

      <main className="main-content">
        {/* Topbar Informatif */}
        <header
          className="topbar"
          style={{
            background: "#ffffff",
            padding: "0.85rem 1.35rem",
            borderRadius: "12px",
            boxShadow: "var(--shadow)",
            border: "1px solid rgba(231, 231, 255, 0.7)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              {currentHeader.title}
            </div>
            <div
              style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}
            >
              {currentHeader.subtitle}
            </div>
          </div>

          <div className="topbar-actions" style={{ gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "#f8fafc",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "0.8rem",
                color: "var(--text)",
                fontWeight: 600,
              }}
            >
              <CalendarClock size={15} color="var(--primary)" />
              <span>
                {formattedDate} • {formattedTime} WIB
              </span>
            </div>

            {/* <div
              title="Core Yii2 & Service Node.js Aktif"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#dcfce7',
                color: '#15803d',
                padding: '0.38rem 0.7rem',
                borderRadius: '999px',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              <Server size={13} />
              <span>Hybrid API Online</span>
            </div> */}

            <span className="badge badge-info" style={{ fontWeight: 700 }}>
              {user?.role}
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                paddingLeft: "0.5rem",
                borderLeft: "1px solid #e2e8f0",
              }}
            >
              <div style={{ textAlign: "right", lineHeight: 1.25 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  {user?.nama_lengkap}
                </div>
                <small
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.74rem",
                  }}
                >
                  @{user?.username}
                </small>
              </div>
              <div className="avatar-circle">
                {initials}
                <span className="status-dot" />
              </div>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
