import type { Locator } from '@playwright/test';
import { expect } from './expect';

/** Phone and small-phone viewports used by the layout checks. */
export const PHONE = { width: 360, height: 800 } as const;
export const SMALL_PHONE = { width: 320, height: 800 } as const;

/**
 * An element is reachable when no ancestor that users cannot scroll (overflow hidden or clip) cuts
 * it off and, scrolled into view, its centre is the topmost element there. scrollIntoView alone
 * proves nothing: it also scrolls overflow-hidden boxes, which a user cannot do.
 */
export async function expectReachable(locator: Locator): Promise<void> {
  const clippedBy = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const box = ancestor.getBoundingClientRect();
      const left = rect.left - box.left + ancestor.scrollLeft;
      const top = rect.top - box.top + ancestor.scrollTop;
      const clipsX = ['hidden', 'clip'].includes(style.overflowX) && (left < 0 || left + rect.width / 2 > ancestor.clientWidth);
      const clipsY = ['hidden', 'clip'].includes(style.overflowY) && (top < 0 || top + rect.height / 2 > ancestor.clientHeight);
      if (clipsX || clipsY) return ancestor.getAttribute('data-testid') ?? ancestor.tagName.toLowerCase();
    }
    return null;
  });
  expect(clippedBy, `${locator.toString()} is not clipped by an ancestor`).toBeNull();
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const inViewport = x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
    const top = inViewport ? document.elementFromPoint(x, y) : null;
    return { inViewport, onTop: !!top && (top === element || element.contains(top)) };
  });
  expect(hit, `${locator.toString()} is reachable`).toEqual({ inViewport: true, onTop: true });
}

/** The element's right edge stays inside the container's right edge. */
export async function expectContainedIn(element: Locator, container: Locator): Promise<void> {
  const [inner, outer] = [await element.boundingBox(), await container.boundingBox()];
  expect(inner, `${element.toString()} is rendered`).not.toBeNull();
  expect(outer, `${container.toString()} is rendered`).not.toBeNull();
  expect(inner!.x + inner!.width, `${element.toString()} ends inside ${container.toString()}`).toBeLessThanOrEqual(outer!.x + outer!.width + 1);
}

/** The page does not scroll sideways. */
export async function expectNoHorizontalPageOverflow(locator: Locator): Promise<void> {
  const { overflow, offenders } = await locator.page().evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    // The outermost elements that end past the right edge, to name the culprit in the failure.
    offenders: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .filter((element) => !(element.parentElement && element.parentElement.getBoundingClientRect().right > window.innerWidth + 1))
      .slice(0, 5)
      .map((element) => element.getAttribute('data-testid') ?? element.tagName.toLowerCase()),
  }));
  expect(overflow, `horizontal page overflow in px (${offenders.join(', ')})`).toBeLessThanOrEqual(1);
}

/**
 * WCAG contrast ratio of the element's text colour against the first opaque background behind it.
 * Colours are resolved by a canvas, so any CSS colour syntax (oklch, hsl, color-mix) works.
 */
export async function textContrast(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    let background = { r: 255, g: 255, b: 255, a: 1 };
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color.a >= 0.99) {
        background = color;
        break;
      }
    }
    const text = luminance(rgba(getComputedStyle(element).color));
    const back = luminance(background);
    return (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05);
  });
}

/** WCAG 1.4.3 AA for normal-size text. */
export async function expectReadableText(locator: Locator): Promise<void> {
  expect(await textContrast(locator), `${locator.toString()} text contrast`).toBeGreaterThanOrEqual(4.5);
}
