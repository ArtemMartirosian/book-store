export type CatalogPointerPoint = { x: number; y: number };

export function isMovingTowardCatalogColumn(origin: CatalogPointerPoint, current: CatalogPointerPoint, column: { left: number; top: number; bottom: number }): boolean {
  const distance = column.left - origin.x;
  if (distance <= 0 || current.x <= origin.x || current.x > column.left) return false;
  const progress = (current.x - origin.x) / distance;
  const top = origin.y + (column.top - 40 - origin.y) * progress;
  const bottom = origin.y + (column.bottom + 40 - origin.y) * progress;
  return current.y >= top && current.y <= bottom;
}
