import { useNavigate } from "react-router";
import { Layout } from "../components/Layout";
import { Button } from "../components/Button";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-xl text-gray-600 mb-2">Página não encontrada</p>
          <p className="text-gray-500">
            O endereço que você procura não existe ou foi removido.
          </p>
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-2"
          >
            Ir para Dashboard
          </Button>
          <Button
            onClick={() => navigate(-1)}
            variant="secondary"
            className="px-6 py-2"
          >
            Voltar
          </Button>
        </div>
      </div>
    </Layout>
  );
}
