import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="shell">
      <h1>Not found</h1>
      <p className="lede">That page does not exist.</p>
      <Link to="/">Back to home</Link>
    </main>
  );
}
