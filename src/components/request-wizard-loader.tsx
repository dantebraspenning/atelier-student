'use client';

import dynamic from 'next/dynamic';

/** The wizard keeps its draft in sessionStorage, so it renders in the browser only. */
export const RequestWizardLoader = dynamic(() => import('./request-wizard').then((m) => m.RequestWizard), {
  ssr: false,
  loading: () => <div className="wrap-narrow py-24 text-center text-muted">…</div>
});
