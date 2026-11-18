import { createContext, useContext, useState } from "react";
import { yiiApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("simrs_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (username, password) => {
    const res = await yiiApi.post("/auth/login", { username, password });
    const { token, user: userData } = res.data.data;
    localStorage.setItem("simrs_token", token);
    localStorage.setItem("simrs_user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("simrs_token");
    localStorage.removeItem("simrs_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
