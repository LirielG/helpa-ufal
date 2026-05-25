import { useAuthStore } from "../stores/authStore";

export const useAuth = () => {
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const user = useAuthStore((state) => state.user);

  return {
    login,
    register,
    logout,
    isLoading,
    error,
    isAuthenticated: !!user,
    user,
  };
};
