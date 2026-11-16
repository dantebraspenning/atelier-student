import { expect, test, type Page } from '@playwright/test';

// Demo accounts are created by src/lib/seed.ts on an empty development database.
const PASSWORD = 'atelier-demo-2026';

async function signIn(page: Page, email: string) {
  await page.goto('/en/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'));
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.waitForURL(/\/en\/?$/);
}

test('a customer pays, the maker ships, the customer confirms and the maker is paid', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  // Customer accepts the seeded quote and pays in the simulated checkout.
  await signIn(page, 'sara@demo.atelier.test');
  await expect(page).toHaveURL(/\/en\/requests$/);
  await page.getByRole('link', { name: /Wide-leg linen trousers/ }).click();
  await page.getByRole('button', { name: /Accept · pay/ }).click();
  await expect(page).toHaveURL(/\/dev\/checkout\//);
  await page.getByRole('button', { name: 'Pay (test)' }).click();
  await expect(page.getByText('Payment received — your piece is being made')).toBeVisible();
  await expect(page.getByText(/held safely and only released to Mateo/)).toBeVisible();
  await signOut(page);

  // Maker ships it.
  await signIn(page, 'mateo@demo.atelier.test');
  await page.goto('/en/studio/commissions');
  await page.getByLabel('Tracking link (optional)').fill('https://tracking.example/123');
  await page.getByRole('button', { name: 'Mark as shipped' }).click();
  await expect(page.getByText(/released when Sara confirms/)).toBeVisible();
  await signOut(page);

  // Customer confirms receipt and leaves a review.
  await signIn(page, 'sara@demo.atelier.test');
  await page.getByRole('link', { name: /Wide-leg linen trousers/ }).click();
  await expect(page.getByRole('link', { name: /Track your parcel/ })).toBeVisible();
  await page.getByRole('button', { name: /I’ve received it/ }).click();
  await expect(page.getByText(/has been released to Mateo/)).toBeVisible();
  await page.getByRole('radio', { name: '5/5' }).click();
  await page.getByLabel('Your review').fill('Perfect length, beautifully finished.');
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Perfect length, beautifully finished.')).toBeVisible();
  await signOut(page);

  // Maker sees the payout and the review on their public page.
  await signIn(page, 'mateo@demo.atelier.test');
  await page.goto('/en/studio/commissions');
  await expect(page.getByText(/paid out to you/)).toBeVisible();
  await page.goto('/en/makers/mateo-ruiz?tab=reviews');
  await expect(page.getByText('Perfect length, beautifully finished.')).toBeVisible();
});

test('pages are available in Dutch and English, and private pages require sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(nl|en)$/);
  await page.goto('/nl/makers');
  await expect(page.getByRole('heading', { name: 'Vind iemand die het maakt.' })).toBeVisible();
  await page.goto('/en/makers');
  await expect(page.getByRole('heading', { name: 'Find someone to make it.' })).toBeVisible();
  await page.goto('/en/studio');
  await expect(page).toHaveURL(/\/en\/sign-in\?next=/);
  const res = await page.request.get('/api/health');
  expect(res.ok()).toBeTruthy();
});
