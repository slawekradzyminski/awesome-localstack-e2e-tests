import { test } from '@playwright/test';

type AsyncMethod<This, Args extends unknown[], Return> = (this: This, ...args: Args) => Promise<Return>;

/**
 * Reports a helper method as one boxed `test.step`, so the HTML report reads as a story
 * ("Shopper › place an order of 100") and a failure inside points at the test line that called it.
 *
 * The title may refer to arguments by position: `@step('pay order {0} with card {1}')`.
 * Without a title the step is named after the class and method.
 */
export function step(title?: string) {
  return function decorate<This, Args extends unknown[], Return>(
    method: AsyncMethod<This, Args, Return>,
    context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Return>>,
  ): AsyncMethod<This, Args, Return> {
    return function stepped(this: This, ...args: Args): Promise<Return> {
      const owner = typeof this === 'function' ? this.name : (this as object).constructor.name;
      const name = title === undefined ? String(context.name) : format(title, args);
      return test.step(`${owner} › ${name}`, () => method.apply(this, args), { box: true });
    };
  };
}

function format(title: string, args: unknown[]): string {
  return title.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const value = args[Number(index)];
    return value === undefined ? placeholder : label(value);
  });
}

/** Entities print as their id (#42), lists and plain objects as JSON, everything else as text. */
function label(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  const { id } = value as { id?: unknown };
  return typeof id === 'number' || typeof id === 'string' ? `#${id}` : JSON.stringify(value);
}
