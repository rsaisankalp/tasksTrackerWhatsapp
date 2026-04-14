"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { useState, useEffect } from "react";

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

export default function Sidebar({ orgs, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentOrgIdx, setCurrentOrgIdx] = useState(0);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedId = localStorage.getItem("currentOrgId");
    if (storedId) {
      const idx = orgs.findIndex((o) => o.id === storedId);
      if (idx !== -1) setCurrentOrgIdx(idx);
    }
  }, [orgs]);

  const currentOrg = orgs[currentOrgIdx];

  const handleOrgSelect = (idx: number, id: string) => {
    setCurrentOrgIdx(idx);
    setOrgMenuOpen(false);
    localStorage.setItem("currentOrgId", id);
    router.push(`${pathname}?orgId=${id}`);
  };

  return (
    <aside className="hidden md:flex w-[248px] shrink-0 flex-col h-screen border-r border-primary-500/10 shadow-[inset_-1px_0_0_rgba(255,255,255,0.65)] bg-gradient-to-b from-[#FFFDF9] to-[#FFF5EC]">
      {/* Brand */}
      <div className="p-[20px_16px_16px] border-b border-primary-500/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-[0_0_16px_rgba(244,124,32,0.4)] shrink-0">
            <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="text-gray-900 font-bold text-[15px] tracking-[-0.3px]">TaskFlow</span>
        </div>
      </div>

      {/* Org Switcher */}
      <div className="p-[12px_12px_8px] border-b border-primary-500/10 relative">
        <button
          onClick={() => setOrgMenuOpen(!orgMenuOpen)}
          className={`w-full flex items-center gap-2.5 p-[8px_10px] rounded-xl text-left transition-all shadow-[0_8px_24px_rgba(244,124,32,0.06)] hover:bg-white/90 border ${
            orgMenuOpen ? "bg-white/90 border-primary-500/15" : "bg-white/60 border-primary-500/10"
          }`}
        >
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-[13px] shrink-0">
            {(mounted ? currentOrg?.name?.[0]?.toUpperCase() : orgs[0]?.name?.[0]?.toUpperCase()) ?? "T"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-gray-900 text-[13px] font-semibold truncate">
              {mounted ? (currentOrg?.name ?? "Select Org") : (orgs[0]?.name ?? "Select Org")}
            </div>
            <div className="text-[#7C6F64] text-[11px] mt-[1px] capitalize truncate">
              {mounted ? (currentOrg?.role?.toLowerCase() ?? "") : (orgs[0]?.role?.toLowerCase() ?? "")}
            </div>
          </div>
          <svg width="14" height="14" fill="none" stroke="#7C6F64" viewBox="0 0 24 24" className="shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </button>

        {orgMenuOpen && (
          <>
            {/* Backdrop for closing popover */}
            <div className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)}></div>
            <div className="absolute top-[calc(100%-4px)] left-3 right-3 bg-[#FFFDF9] border border-primary-500/10 rounded-xl shadow-[0_22px_44px_rgba(15,23,42,0.12)] z-50 overflow-hidden animate-fade-up">
              {orgs.map((org, idx) => (
                <button
                  key={org.id}
                  onClick={() => handleOrgSelect(idx, org.id)}
                  className={`w-full flex items-center gap-2.5 p-[9px_12px] border-none text-left transition-colors hover:bg-primary-500/5 ${
                    idx === currentOrgIdx ? "bg-primary-500/10" : "bg-transparent"
                  }`}
                >
                  <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                    {org.name[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-gray-900 text-[13px] truncate">{org.name}</span>
                  {(org.type === "PERSONAL" || org.type === "PRIVATE_USER" || org.type === "GENERAL") && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-600 px-1.5 py-0.5 rounded-full shrink-0">
                      Private
                    </span>
                  )}
                  {idx === currentOrgIdx && (
                    <svg width="14" height="14" fill="none" stroke="#F47C20" viewBox="0 0 24 24" className="shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="border-t border-primary-500/10">
                <Link
                  href="/onboarding"
                  onClick={() => setOrgMenuOpen(false)}
                  className="flex items-center gap-2 p-[9px_12px] text-[#7C6F64] text-[13px] transition-colors hover:text-gray-900"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New organization
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-[10px_10px] flex flex-col gap-0.5">
        <div className="text-[10px] font-semibold tracking-[0.8px] text-[#7C6F64] p-[8px_10px_4px] uppercase">Menu</div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={`${item.href}?orgId=${currentOrg?.id ?? ""}`}
              className={`flex items-center gap-2.5 p-[9px_12px] rounded-[10px] text-[13px] transition-all
                ${
                  isActive
                    ? "font-semibold bg-gradient-to-br from-primary-500 to-[#FF9B4A] text-white shadow-[0_4px_12px_rgba(244,124,32,0.3)]"
                    : "font-medium text-[#7C6F64] hover:bg-white/90 hover:text-gray-900"
                }`}
            >
              {item.icon(isActive)}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* WhatsApp */}
      <div className="p-[0_10px_8px]">
        <Link
          href={`/settings?orgId=${currentOrg?.id ?? ""}&tab=whatsapp`}
          className="flex items-center gap-2.5 p-[10px_12px] rounded-xl bg-[#25D366]/10 border border-[#25D366]/15 transition-colors hover:bg-[#25D366]/15"
        >
          <svg width="15" height="15" fill="#25D366" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span className="text-[12px] text-[#4ADE80] flex-1">WhatsApp</span>
          <span className="w-[7px] h-[7px] rounded-full bg-[#25D366] inline-block shadow-[0_0_6px_rgba(37,211,102,0.6)] shrink-0" />
        </Link>
      </div>

      {/* User */}
      <div className="p-[10px_10px_14px] border-t border-primary-500/10">
        <div className="flex items-center gap-2.5 p-[6px_8px]">
          {user.image ? (
            <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full border-2 border-primary-500/40 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-[13px] font-semibold shrink-0">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-gray-900 text-[12px] font-semibold truncate">{user.name}</div>
            <div className="text-[#7C6F64] text-[11px] truncate">{user.email}</div>
          </div>
          <button
            onClick={async () => {
              await firebaseSignOut(firebaseAuth).catch(() => {});
              await fetch("/api/auth/signout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="text-[#7C6F64] p-1 rounded-md transition-colors hover:text-red-500 hover:bg-white"
            title="Sign out"
            aria-label="Sign out"
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
