import Link from 'next/link';

// Paths outside any locale (e.g. /favicon.png typos) get a minimal page.
export default function RootNotFound() {
  return (
    <html lang="en"><body style={{ fontFamily: 'system-ui', background: '#F6F3EC', padding: 48 }}>
      <h1>Page not found</h1><p><Link href="/">Atelier Student</Link></p>
    </body></html>
  );
}
