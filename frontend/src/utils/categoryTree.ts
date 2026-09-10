import type { Category } from '../api';

export const flattenCategoryTree = (categories: Category[]): Category[] => categories.flatMap((category) => [
  category,
  ...flattenCategoryTree(category.children || []),
]);

export const categorySubtreeIds = (categories: Category[], rootID: number): Set<number> => {
  const ids = new Set([rootID]);
  for (let changed = true; changed;) {
    changed = false;
    for (const category of categories) {
      if (ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
};

export const categoryPath = (category: Category, categories: Category[]): string => {
  const byID = new Map(categories.map((item) => [item.id, item]));
  const names = [category.name];
  const seen = new Set([category.id]);
  let parentID = category.parent_id;
  while (parentID && !seen.has(parentID)) {
    const parent = byID.get(parentID);
    if (!parent) break;
    names.unshift(parent.name);
    seen.add(parent.id);
    parentID = parent.parent_id;
  }
  return names.join(' / ');
};
