import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { env, paymentsSimulated } from '@/lib/env';
import { ToastProvider } from '@/components/forms';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument', display: 'swap' });

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: t('title'), template: '%s · Atelier Student' },
    description: t('description'),
    applicationName: 'Atelier Student',
    alternates: { languages: { nl: '/nl', en: '/en' } },
    openGraph: { type: 'website', siteName: 'Atelier Student', locale: locale === 'nl' ? 'nl_NL' : 'en_GB', title: t('title'), description: t('description') },
    appleWebApp: { capable: true, title: 'Atelier', statusBarStyle: 'default' }
  };
}

export const viewport: Viewport = { themeColor: '#F6F3EC', width: 'device-width', initialScale: 1 };

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'common' });
  return (
    <html lang={locale} className={`${inter.variable} ${serif.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <ToastProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-linen">{t('skip')}</a>
            {paymentsSimulated() && (
              <div className="bg-clay-mist px-4 py-2 text-center text-[13px] text-clay-deep">{t('simulatedPayments')}</div>
            )}
            <Header locale={locale} />
            <main id="main" className="flex-1">{children}</main>
            <Footer locale={locale} />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
