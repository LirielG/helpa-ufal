import { useNavigate } from "react-router";
import { Button, Layout } from "../components";
import { useAuth } from "../hooks";

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm font-medium text-blue-600 uppercase tracking-[0.2em] mb-3">
              Área autenticada
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Bem-vindo, {user?.fullName ?? "usuário"}
            </h1>
            <p className="text-gray-600">
              Sua sessão está ativa via cookie e o estado visual está sendo controlado pelo zustand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl border border-gray-200 p-4">
              <span className="block text-sm text-gray-500 mb-1">E-mail</span>
              <span className="font-medium text-gray-900">{user?.email ?? "-"}</span>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <span className="block text-sm text-gray-500 mb-1">Tipo de usuário</span>
              <span className="font-medium text-gray-900">{user?.userType ?? "-"}</span>
            </div>
          </div>

          <Button type="button" variant="navy" size="lg" isLoading={isLoading} onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </div>
    </Layout>
  );
}