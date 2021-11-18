export function isCfIntrinsicFunction(object: unknown) {
  if (typeof object === 'object' && object !== null) {
    const keys = Object.keys(object);
    if (keys.length === 1) {
      const key = keys[0];
      if (key.startsWith('Fn::') || key === 'Ref') {
        const value = object[keys[0]];
        if (
          Array.isArray(value) ||
          typeof value === 'string' ||
          (key === 'Fn::Transform' && typeof value === 'object')
        ) {
          return true;
        }
      }
    }
  }
  return false;
}