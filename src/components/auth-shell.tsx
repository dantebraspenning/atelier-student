import type { ReactNode } from 'react';
import { Flat } from './flat';

export function AuthShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="wrap-narrow flex flex-wrap items-center gap-12 py-14">
      <div className="flex flex-[1_1_360px] flex-col gap-5">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h1">{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        <div aria-hidden className="mt-2 hidden gap-4 sm:flex">
          <div className="arch tint-sage h-[180px] w-[130px]"><Flat garment="dress" width={70} height={96} /></div>
          <div className="arch tint-clay h-[150px] w-[110px] self-end"><Flat garment="trousers" width={60} height={82} /></div>
        </div>
      </div>
      <div className="flex max-w-[520px] flex-[1_1_420px] flex-col gap-4">{children}</div>
    </div>
  );
}
