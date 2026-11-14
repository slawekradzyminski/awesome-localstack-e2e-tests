import { test, expect } from '@fixtures';
import { GDANSK_CATEGORY, LOCATIONS } from '@support/locations';

test.describe('warehouse locations page', { tag: ['@fulfilment', '@admin'] }, () => {
  test('lists both locations with the categories they ship and an empty reconciliation', async ({ locations, warehouseLocationsPage }) => {
    // given
    const listed = await locations.list();

    // when
    await warehouseLocationsPage.goto();

    // then
    expect(listed.map(location => location.code)).toEqual(['KRK', 'GDN']);
    await expect(warehouseLocationsPage.name('KRK')).toHaveText(LOCATIONS.KRK.name);
    await expect(warehouseLocationsPage.name('GDN')).toHaveText(LOCATIONS.GDN.name);
    await expect(warehouseLocationsPage.primary('GDN')).toContainText(GDANSK_CATEGORY);
    await expect(warehouseLocationsPage.status('KRK')).toHaveText('ACTIVE');
    await expect(warehouseLocationsPage.reconciliation).toBeVisible();
  });

  test('switching a location off shows it inactive and the API agrees', async ({ locations, warehouseLocationsPage }) => {
    // given
    await warehouseLocationsPage.goto();

    // when
    await warehouseLocationsPage.switchOff('GDN');

    // then
    await expect(warehouseLocationsPage.status('GDN')).toHaveText('INACTIVE');
    await expect(warehouseLocationsPage.toggle('GDN')).toHaveText('Activate');
    expect((await locations.list()).find(location => location.code === 'GDN')?.active).toBe(false);
  });
});
