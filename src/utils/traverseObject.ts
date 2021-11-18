/**
 * @returns false if you want to stop visiting children properties
 */
type Visitor = (
  node: unknown,
  parent: unknown,
  key: string,
  path: string[]
) => boolean;

/**
 * Traverse objects by visiting every node on a recursive walk.
 */
export function traverseObject(
  object: unknown,
  visitor: Visitor,
  visited: Set<unknown> = new Set(),
  key: string | null = null,
  path: string[] = [],
  parent: unknown = null
) {
  if (visited.has(object)) return;
  visited.add(object);

  // only visit if its not our root object
  if (
    key &&
    (Array.isArray(parent) || typeof parent === 'object') &&
    parent !== null
  ) {
    if (!visitor(object, parent, key, path)) return;
    // check if our object was changed by visitor...
    const newObject = parent[key];
    if (newObject !== object && !visited.has(newObject)) {
      // visit our new object instead
      traverseObject(newObject, visitor, visited, key, path, parent);
      return;
    }
  }
  if (Array.isArray(object) || typeof object === 'object') {
    for (const key in object) {
      const node = object[key];
      traverseObject(node, visitor, visited, key, [...path, key], object);
    }
  } else {
    traverseObject(object, visitor, visited, key, path, parent);
  }
}
