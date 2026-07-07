import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import Parties from "./pages/Parties";
import PartyRoom from "./pages/PartyRoom";
import Admin from "./pages/Admin";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0A0A0E]"><div className="flex items-end gap-1 h-5"><div className="eq-bar" /><div className="eq-bar" /><div className="eq-bar" /></div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <PlayerProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route element={<Protected><Layout /></Protected>}>
                <Route path="/" element={<Home />} />
                <Route path="/library" element={<Library />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/profile/:username" element={<Profile />} />
                <Route path="/parties" element={<Parties />} />
                <Route path="/party/:id" element={<PartyRoom />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster theme="dark" position="top-right" />
        </PlayerProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
