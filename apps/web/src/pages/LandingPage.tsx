import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <main className="shell">
      <p className="eyebrow">Flash Sale System</p>
      <h1>Flash Sale</h1>
      <p className="lede">Enter a flash sale URL to get started.</p>
      <p>
        Example: <code>/sales/&lt;flashSaleId&gt;</code>
      </p>
      <p>
        <Link to="/sales/demo-sale">Open example flash sale</Link>
      </p>
    </main>
  );
}
