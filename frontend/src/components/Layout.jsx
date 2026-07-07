import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Home, Library, Users, PartyPopper, Upload, LogOut, AudioWaveform } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Player from "./Player";

const navItems = [
  { to: "/", label: "Home", icon: Home, tid: "nav-home" },
  { to: "/library", label: "Library", icon: Library, tid: "nav-library" },
  { to: "/friends", label: "Friends", icon: Users, tid: "nav-friends" },
  { to: "/parties", label: "Parties", icon: PartyPopper, tid: "nav-parties" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0E] text-slate-50 flex">
      <aside className="w-60 fixed inset-y-0 left-0 hidden md:flex flex-col border-r border-white/5 bg-[#0C0C12] z-30">
        <div className="p-6 flex items-center gap-2.5">
          <AudioWaveform className="w-6 h-6 text-[#C4B5FD]" />
          <span className="font-heading text-xl font-medium tracking-tight">Resonance</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, tid }) => (
            <NavLink key={to} to={to} end={to === "/"} data-testid={tid}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              <Icon className="w-4.5 h-4.5" size={18} />
              {label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/admin" data-testid="nav-admin"
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
              <Upload size={18} /> Admin
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t border-white/5">
          <button data-testid="sidebar-profile-btn" onClick={() => navigate(`/profile/${user.username}`)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left">
            <div className="w-9 h-9 rounded-full bg-[#C4B5FD]/20 border border-[#C4B5FD]/30 flex items-center justify-center text-sm font-medium text-[#C4B5FD]">
              {user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">@{user.username}</p>
            </div>
          </button>
          <button data-testid="logout-btn" onClick={() => { logout(); navigate("/auth"); }}
            className="w-full mt-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed bottom-24 inset-x-0 z-40 px-4">
        <div className="glass rounded-2xl flex justify-around py-2">
          {navItems.map(({ to, icon: Icon, tid }) => (
            <NavLink key={to} to={to} end={to === "/"} data-testid={`m-${tid}`}
              className={({ isActive }) => `p-3 rounded-xl ${isActive ? "text-[#C4B5FD]" : "text-slate-400"}`}>
              <Icon size={20} />
            </NavLink>
          ))}
        </div>
      </div>

      <main className="flex-1 md:ml-60 pb-28">
        <Outlet />
      </main>
      <Player />
    </div>
  );
}
