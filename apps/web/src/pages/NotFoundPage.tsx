import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-[40rem] px-6 py-16">
      <h1 className="mb-4 text-3xl leading-tight font-semibold text-emerald-950 sm:text-4xl">
        Not found
      </h1>
      <p className="max-w-lg text-emerald-900/70">That page does not exist.</p>
      <Link
        className="mt-6 inline-block text-sm font-semibold text-emerald-800 hover:underline"
        to="/"
      >
        Back to home
      </Link>
    </main>
  );
}
