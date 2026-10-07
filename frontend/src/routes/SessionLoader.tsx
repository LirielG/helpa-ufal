/**
 * Shown by the route guards while the stored session is being confirmed, so
 * neither the guarded screen nor the login screen flashes before the answer.
 */
export function SessionLoader() {
  return (
    <div
      role="status"
      className="flex items-center justify-center min-h-screen"
    >
      <p className="text-gray-500 text-lg">Verificando sessão...</p>
    </div>
  );
}
