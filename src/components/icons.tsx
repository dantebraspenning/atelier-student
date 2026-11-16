import type { SVGProps } from 'react';

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true
});

export const Arrow = ({ size = 18 }) => <svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const Back = ({ size = 16 }) => <svg {...base(size)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const Check = ({ size = 20 }) => <svg {...base(size)}><path d="M4 12.5l5 5L20 6.5" /></svg>;
export const Shield = ({ size = 20 }) => <svg {...base(size)}><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
export const Search = ({ size = 18 }) => <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
export const Close = ({ size = 16 }) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const Chat = ({ size = 16 }) => <svg {...base(size)}><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const Camera = ({ size = 20 }) => <svg {...base(size)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
export const Clip = ({ size = 20 }) => <svg {...base(size)}><path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8" /></svg>;
export const Bell = ({ size = 18 }) => <svg {...base(size)}><path d="M6 16V11a6 6 0 1112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></svg>;
export const Flag = ({ size = 14 }) => <svg {...base(size)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
export const Star = ({ size = 16, filled = false }) => <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>;
export const Menu = ({ size = 22 }) => <svg {...base(size)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const Stitch = () => (
  <svg aria-hidden="true" width="120" height="24" viewBox="0 0 120 24" fill="none" stroke="#4A5A3F" strokeWidth="1.2" strokeLinecap="round">
    <path d="M2 12 C 22 2, 38 22, 60 12 S 98 2, 118 12" strokeDasharray="3 4" />
  </svg>
);
