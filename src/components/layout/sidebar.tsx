"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useState } from "react";

interface Org {
  id: string;
  name: string;
  slug: string;
  role: string;
  type?: string;
}

interface SidebarProps {
  orgs: Org[];
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (active: boolean) => (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "Projects",
    icon: (active: boolean) => (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: (active: boolean) => (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (active: boolean) => (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const SB = "linear-gradient(180deg, rgba(255,250,244,0.98) 0%, rgba(255,245,236,0.98) 100%)";
const SB2 = "rgba(255,255,255,0.9)";
const BORDER = "rgba(244,124,32,0.12)";
const TEXT_MUT = "#7C6F64";
const TEXT_ACT = "#1F2937";

export default function Sidebar({ orgs, user }: SidebarProps) {
  const pathname = usePathname();
  const [currentOrgIdx, setCurrentOrgIdx] = useState(0);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  const currentOrg = orgs[currentOrgIdx];

  if (typeof window !== "undefined" && currentOrg) {
    localStorage.setItem("currentOrgId", currentOrg.id);
  }

  return (
    <aside style={{ width: 248, flexShrink: 0, background: SB, display: "flex", flexDirection: "column", height: "100vh", borderRight: `1px solid ${BORDER}`, boxShadow: "inset -1px 0 0 rgba(255,255,255,0.65)" }} className="hidden md:flex">
      {/* Brand */}
      <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(244,124,32,0.4)", flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span style={{ color: "#111827", fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>TaskFlow</span>
        </div>
      </div>

      {/* Org Switcher */}
      <div style={{ padding: "12px 12px 8px", borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
        <button
          onClick={() => setOrgMenuOpen(!orgMenuOpen)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 14, background: orgMenuOpen ? SB2 : "rgba(255,255,255,0.58)", border: `1px solid ${orgMenuOpen ? "rgba(244,124,32,0.14)" : "rgba(244,124,32,0.08)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxShadow: "0 8px 24px rgba(244,124,32,0.06)" }}
          onMouseEnter={e => (e.currentTarget.style.background = SB2)}
          onMouseLeave={e => { if (!orgMenuOpen) e.currentTarget.style.background = "rgba(255,255,255,0.58)"; }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {currentOrg?.name?.[0]?.toUpperCase() ?? "T"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#111827", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentOrg?.name ?? "Select Org"}</div>
            <div style={{ color: TEXT_MUT, fontSize: 11, marginTop: 1, textTransform: "capitalize" }}>{currentOrg?.role?.toLowerCase() ?? ""}</div>
          </div>
          <svg width="14" height="14" fill="none" stroke={TEXT_MUT} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </button>

        {orgMenuOpen && (
          <div style={{ position: "absolute", top: "calc(100% - 4px)", left: 12, right: 12, background: "#FFFDF9", border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 22px 44px rgba(15,23,42,0.12)", zIndex: 50, overflow: "hidden" }}>
            {orgs.map((org, idx) => (
              <button key={org.id} onClick={() => { setCurrentOrgIdx(idx); setOrgMenuOpen(false); if (typeof window !== "undefined") localStorage.setItem("currentOrgId", org.id); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: idx === currentOrgIdx ? "rgba(244,124,32,0.1)" : "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                onMouseEnter={e => { if (idx !== currentOrgIdx) e.currentTarget.style.background = "rgba(244,124,32,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = idx === currentOrgIdx ? "rgba(244,124,32,0.1)" : "transparent"; }}
              >
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                  {org.name[0].toUpperCase()}
                </div>
                <span style={{ flex: 1, color: "#111827", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.name}</span>
                {org.type === "PERSONAL" && <span style={{ fontSize: 10, background: "rgba(139,92,246,0.2)", color: "#C4B5FD", padding: "2px 6px", borderRadius: 20, flexShrink: 0 }}>Personal</span>}
                {org.type === "GENERAL" && <span style={{ fontSize: 10, background: "rgba(244,124,32,0.2)", color: "#FDBA74", padding: "2px 6px", borderRadius: 20, flexShrink: 0 }}>General</span>}
                {idx === currentOrgIdx && <svg width="14" height="14" fill="none" stroke="#F47C20" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href="/onboarding" onClick={() => setOrgMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", color: TEXT_MUT, fontSize: 13, textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUT)}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New organization
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.8px", color: TEXT_MUT, padding: "8px 10px 4px", textTransform: "uppercase" }}>Menu</div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={`${item.href}?orgId=${currentOrg?.id ?? ""}`}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: isActive ? 600 : 500, textDecoration: "none", transition: "all 0.15s",
                background: isActive ? "linear-gradient(135deg, #F47C20, #FF9B4A)" : "transparent",
                color: isActive ? "white" : TEXT_MUT,
                boxShadow: isActive ? "0 4px 12px rgba(244,124,32,0.3)" : "none",
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = SB2; e.currentTarget.style.color = TEXT_ACT; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = TEXT_MUT; } }}
            >
              {item.icon(isActive)}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* WhatsApp */}
      <div style={{ padding: "0 10px 8px" }}>
        <Link href={`/settings?orgId=${currentOrg?.id ?? ""}&tab=whatsapp`}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.14)", textDecoration: "none", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(37,211,102,0.12)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(37,211,102,0.08)")}
        >
          <svg width="15" height="15" fill="#25D366" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span style={{ fontSize: 12, color: "#4ADE80", flex: 1 }}>WhatsApp</span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#25D366", display: "inline-block", boxShadow: "0 0 6px rgba(37,211,102,0.6)" }} />
        </Link>
      </div>

      {/* User */}
      <div style={{ padding: "10px 10px 14px", borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
          {user.image ? (
            <img src={user.image} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid rgba(244,124,32,0.4)`, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #F47C20, #FDB813)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#111827", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
            <div style={{ color: TEXT_MUT, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          <button
            onClick={async () => { await firebaseSignOut(firebaseAuth).catch(() => {}); await fetch("/api/auth/signout", { method: "POST" }); window.location.href = "/login"; }}
            style={{ background: "none", border: "none", color: TEXT_MUT, cursor: "pointer", padding: 4, borderRadius: 6, transition: "color 0.15s", display: "flex", alignItems: "center" }}
            title="Sign out"
            onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUT)}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
