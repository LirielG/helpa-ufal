export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-blue-600">
          Helpa
        </h1>
        <p className="mt-2 text-gray-600">
          O Tailwind CSS está configurado com sucesso no frontend!
        </p>
        
        <button 
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Botão de teste do Tailwind"
        >
          Começar a desenvolver
        </button>
      </div>
    </main>
  );
}