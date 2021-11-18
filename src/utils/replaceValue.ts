import { trace, traceEnabled } from "./logger";

export function replaceValue(parent: unknown, key: string, path: string[], newValue: unknown) {
  if (traceEnabled) trace(`Replacing ${path.join('.')} with`, newValue)
  if (Array.isArray(parent) || typeof parent === 'object') {
    if (parent) {
      if (key) {
        parent[key] = newValue;
        if (traceEnabled) trace("Parent after replacing:", parent);
        return;
      }
    }
  }
  throw new Error(`Failed to replace value at ${path.join('.')}`);
}