export interface CatalogCategoryNode {
  id: string;
  parentId: string | null;
}

/** Include direct assignments and every descendant, even if a bad tree has a cycle. */
export function catalogCategorySubtree(
  rootId: string,
  categories: readonly CatalogCategoryNode[],
): ReadonlySet<string> {
  if (!categories.some(({ id }) => id === rootId)) return new Set();

  const children = new Map<string, string[]>();
  for (const { id, parentId } of categories) {
    if (!parentId) continue;
    const siblings = children.get(parentId);
    if (siblings) siblings.push(id);
    else children.set(parentId, [id]);
  }

  const scope = new Set([rootId]);
  for (const parent of scope) {
    for (const child of children.get(parent) ?? []) scope.add(child);
  }
  return scope;
}
