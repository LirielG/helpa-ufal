import { SIGAA_PAGE_SIZE } from "../constants";

export function SigaaListSkeleton() {
  return (
    <>
      <p className="sr-only">Buscando ações do SIGAA...</p>

      <ul
        aria-hidden="true"
        data-testid="sigaa-skeleton"
        className="flex flex-col gap-4"
      >
        {Array.from({ length: SIGAA_PAGE_SIZE }, (_, index) => (
          <li
            key={index}
            className="animate-pulse bg-white rounded-xl border border-gray-200 px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <div className="h-6 w-2/3 rounded bg-gray-200" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 rounded bg-gray-200" />
                <div className="h-5 w-40 rounded bg-gray-200" />
              </div>
            </div>
            <div className="h-10 w-full shrink-0 rounded-lg bg-gray-200 sm:w-36" />
          </li>
        ))}
      </ul>
    </>
  );
}