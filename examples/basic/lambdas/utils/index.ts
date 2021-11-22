export function parseAllNestedJsonStrings(object: unknown): unknown {
  traverse(object, (node: unknown) => {
    if (
      typeof node === 'string' &&
      (node.startsWith('[') || node.startsWith('{'))
    ) {
      try {
        return JSON.parse(node);
      } catch (e) {
        // ignore errors...
      }
    }
    return node;
  });
  return object;
}

function traverse(
  node: unknown,
  replace: (node: unknown) => void,
  visited: Set<unknown> = new Set(),
  path: string[] = [],
  parent?: unknown
) {
  if (visited.has(node)) return;
  visited.add(node);
  let currentNode = node;
  if (path.length && parent) {
    const newNode = replace(node);
    if (newNode !== node) {
      parent[path[path.length - 1]] = newNode;
      currentNode = newNode;
    }
  }
  if (Array.isArray(currentNode) || typeof currentNode === 'object') {
    for (const key in currentNode) {
      traverse(currentNode[key], replace, visited, [...path, key], currentNode);
    }
  }
}
