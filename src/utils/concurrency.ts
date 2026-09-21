/** Run async tasks with a max number in flight at once. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}
