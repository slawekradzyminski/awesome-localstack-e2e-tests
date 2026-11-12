import { test, expect } from '@fixtures';
import { InboxReceiver, PUBLIC_URL, SECRET_FORMAT, createInbox, isSignedWith, subscribe } from '@support/webhooks';
import type { WebhookSubscriptionDto } from '@models/webhook';

test.describe('account webhooks /account/webhooks - subscriptions', { tag: ['@webhooks'] }, () => {
  test('shows empty states for a user without webhooks or inboxes', async ({ webhooksPage }) => {
    // given

    // when
    await webhooksPage.goto();

    // then
    await expect(webhooksPage.heading).toBeVisible();
    await expect(webhooksPage.subscriptionsEmpty).toHaveText('No webhooks yet. Create one to start receiving events.');
    await expect(webhooksPage.inboxes.empty).toHaveText('You have no inboxes yet.');
    await expect(webhooksPage.inboxes.count).toHaveText('0 of 3 inboxes used');
    await expect(webhooksPage.createForm.event('webhook.ping')).toBeVisible();
  });

  test('creates a subscription for a new inbox and shows its secret only once', async ({ shopperPage, context, shopper, webhooksPage }) => {
    // given
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await webhooksPage.goto();
    await webhooksPage.inboxes.createInbox();
    await expect(webhooksPage.inboxes.count).toHaveText('1 of 3 inboxes used');
    const [inbox] = await (await shopper.webhooks.inboxes()).json();
    await webhooksPage.inboxes.useAsUrl(inbox.token);
    await expect(webhooksPage.createForm.url).toHaveValue(inbox.url);

    // when
    await webhooksPage.createForm.fill({ events: ['order.created', 'order.paid'], description: 'Shop sync' });
    const created = shopperPage.waitForResponse(response => response.url().endsWith('/api/v1/webhooks') && response.request().method() === 'POST');
    await webhooksPage.createForm.submit();

    // then
    await expect(await created).toHaveStatus(201);
    await expect(webhooksPage.createdSecretTitle).toHaveText(`Signing secret for ${inbox.url}`);
    await expect(webhooksPage.createdSecretWarning).toHaveText('Copy this secret now. It is shown only once; if you lose it, rotate the secret to get a new one.');
    await expect(webhooksPage.createdSecretValue).toHaveText(SECRET_FORMAT);
    const secret = (await webhooksPage.createdSecretValue.textContent())!;
    await webhooksPage.copyCreatedSecret();
    await expect(webhooksPage.createdSecretCopyStatus).toHaveText('Signing secret copied to the clipboard.');
    expect(await shopperPage.evaluate(() => navigator.clipboard.readText())).toBe(secret);
    await expect(webhooksPage.createForm.url).toHaveValue('');

    const [stored]: WebhookSubscriptionDto[] = await (await shopper.webhooks.list()).json();
    expect(stored).toMatchObject({ url: inbox.url, events: ['order.created', 'order.paid'], description: 'Shop sync', active: true });
    expect(stored).not.toHaveProperty('secret');
    const card = webhooksPage.subscription(stored.id);
    await expect(card.url).toHaveText(inbox.url);
    await expect(card.description).toHaveText('Shop sync');
    await expect(card.events).toHaveText(/order\.created\s*order\.paid/);
    await expect(card.active).toHaveText('Active');

    // when
    await webhooksPage.dismissSecret();
    await shopperPage.reload();

    // then
    await expect(card.url).toHaveText(inbox.url);
    await expect(webhooksPage.createdSecret).toBeHidden();
    await expect(shopperPage.getByText(secret)).toBeHidden();
  });

  test('checks the form before sending it', async ({ shopper, webhooksPage }) => {
    // given
    await webhooksPage.goto();

    // when
    await webhooksPage.createForm.submit();

    // then
    await expect(webhooksPage.createForm.urlError).toHaveText('URL is required');
    await expect(webhooksPage.createForm.eventsError).toHaveText('Select at least one event');

    // when
    await webhooksPage.createForm.fill({ url: 'ftp://example.com/hook', events: ['order.created'] });
    await webhooksPage.createForm.submit();

    // then
    await expect(webhooksPage.createForm.urlError).toHaveText('Use an http(s):// URL or an inbox:// URL');
    await expect(webhooksPage.createForm.eventsError).toBeHidden();
    expect(await (await shopper.webhooks.list()).json()).toEqual([]);
  });

  const refusedTargets: [string, string, string][] = [
    ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data',
      'Webhook URL rejected: Host 169.254.169.254 resolves to a link-local address; webhooks can only call public addresses'],
    ['a Compose service name', 'http://backend:4001/hook',
      'Webhook URL rejected: Host backend is not a fully qualified domain name; webhooks can only call public hosts'],
    ['a non-standard port', 'https://93.184.215.14:8443/hook', 'Webhook URL rejected: URL port 8443 is not allowed; use 80 or 443'],
  ];
  for (const [name, url, message] of refusedTargets) {
    test(`shows the server's SSRF refusal of ${name} next to the URL`, async ({ shopper, webhooksPage }) => {
      // given
      await webhooksPage.goto();
      await webhooksPage.createForm.fill({ url, events: ['order.created'] });

      // when
      await webhooksPage.createForm.submit();

      // then
      await expect(webhooksPage.createForm.urlError).toHaveText(message);
      await expect(webhooksPage.createForm.url).toHaveValue(url);
      await expect(webhooksPage.subscriptionsEmpty).toBeVisible();
      expect(await (await shopper.webhooks.list()).json()).toEqual([]);
    });
  }

  test('edits the description and pauses a subscription', async ({ shopper, webhooksPage }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created'], 'Before');
    await webhooksPage.goto();
    const card = webhooksPage.subscription(created.id);
    await card.edit();
    await expect(card.editForm.url).toHaveValue(PUBLIC_URL);
    await expect(card.editForm.event('order.created')).toBeChecked();

    // when
    await card.editForm.description.fill('After');
    await card.editForm.event('order.cancelled').check();
    await card.editForm.active.uncheck();
    await card.editForm.submit();

    // then
    await expect(card.editDialog).toBeHidden();
    await expect(card.description).toHaveText('After');
    await expect(card.active).toHaveText('Disabled');
    await expect(card.sendTestButton).toBeDisabled();
    expect(await (await shopper.webhooks.getById(created.id)).json())
      .toMatchObject({ description: 'After', events: ['order.created', 'order.cancelled'], active: false });
  });

  test('shows an SSRF refusal in the edit dialog and keeps the subscription', async ({ shopper, webhooksPage }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);
    await webhooksPage.goto();
    const card = webhooksPage.subscription(created.id);
    await card.edit();

    // when
    await card.editForm.url.fill('http://localhost/hook');
    await card.editForm.submit();

    // then
    await expect(card.editForm.urlError).toHaveText('Webhook URL rejected: Host localhost is internal; webhooks can only call public hosts');
    await card.editForm.cancel();
    await expect(card.url).toHaveText(PUBLIC_URL);
    expect((await (await shopper.webhooks.getById(created.id)).json()).url).toBe(PUBLIC_URL);
  });

  test('deletes a subscription after confirmation', async ({ shopper, webhooksPage }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);
    await webhooksPage.goto();
    const card = webhooksPage.subscription(created.id);

    // when
    await card.delete();
    await expect(card.confirmDialog).toContainText(`Deliveries to ${PUBLIC_URL} stop and its delivery log is deleted. This cannot be undone.`);
    await card.confirm();

    // then
    await expect(card.root).toBeHidden();
    await expect(webhooksPage.subscriptionsEmpty).toBeVisible();
    await expect(await shopper.webhooks.getById(created.id)).toHaveStatus(404);
  });

  test('rotates the secret and shows the new one, which signs the next ping', async ({ shopper, webhooksPage }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await webhooksPage.goto();
    const card = webhooksPage.subscription(receiver.subscription.id);

    // when
    await card.rotateSecret();
    await card.confirm();

    // then
    await expect(card.newSecretValue).toHaveText(SECRET_FORMAT);
    const rotated = (await card.newSecretValue.textContent())!;
    expect(rotated).not.toBe(receiver.secret);
    await expect(await shopper.webhooks.ping(receiver.subscription.id)).toHaveStatus(201);
    const [ping] = await receiver.waitForCount(1);
    expect(isSignedWith(rotated, ping)).toBe(true);
    expect(isSignedWith(receiver.secret, ping)).toBe(false);
  });

  test('explains how to verify signatures and copies the snippet', async ({ shopperPage, context, webhooksPage }) => {
    // given
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await webhooksPage.goto();
    await expect(webhooksPage.signatureHelp).toContainText('X-Webhook-Signature: t=…,v1=…');
    await expect(webhooksPage.signatureSnippet).toContainText("createHmac('sha256', secret)");

    // when
    await webhooksPage.copySignatureSnippet();

    // then
    await expect(webhooksPage.signatureCopyStatus).toHaveText('Verification snippet copied to the clipboard.');
    expect(await shopperPage.evaluate(() => navigator.clipboard.readText())).toBe(await webhooksPage.signatureSnippet.textContent());
  });

  test('stops creating subscriptions at the limit of five and says why', async ({ shopper, webhooksPage }) => {
    // given
    for (let i = 0; i < 5; i++) await subscribe(shopper.webhooks, `${PUBLIC_URL}/${i}`, ['order.created']);
    const inbox = await createInbox(shopper.webhooks);
    await webhooksPage.goto();
    await expect(webhooksPage.subscriptions).toHaveCount(5);

    // when
    await webhooksPage.createForm.fill({ url: inbox.url, events: ['order.paid'] });
    await webhooksPage.createForm.submit();

    // then
    await expect(webhooksPage.createForm.formError).toHaveText('You can have at most 5 webhook subscriptions');
    await expect(webhooksPage.createdSecret).toBeHidden();
    expect(await (await shopper.webhooks.list()).json()).toHaveLength(5);
  });
});
