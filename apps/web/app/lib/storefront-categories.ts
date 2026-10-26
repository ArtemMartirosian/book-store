import type { CatalogCategory } from "./types";

const hiddenSupplierCategoryIds = new Set(["7480"]);

// Keep supplier data intact; hide this branch consistently across public views.
export function visibleStorefrontCategories<T extends Pick<CatalogCategory, "supplierCategoryId" | "parentSupplierCategoryId">>(categories: readonly T[]): T[] {
  const hidden = new Set(hiddenSupplierCategoryIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentSupplierCategoryId && hidden.has(category.parentSupplierCategoryId) && !hidden.has(category.supplierCategoryId)) {
        hidden.add(category.supplierCategoryId);
        changed = true;
      }
    }
  }
  return categories.filter((category) => !hidden.has(category.supplierCategoryId));
}
