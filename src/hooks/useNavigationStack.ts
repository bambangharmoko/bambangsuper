/**
 * useNavigationStack
 *
 * Manages an independent navigation stack for each authenticated user,
 * persisted in sessionStorage (survives re-renders, clears on tab close / logout).
 *
 * Key: `sk-navstack-<userId>`
 */

const STACK_PREFIX = "sk-navstack-";

function stackKey(userId: string) {
  return `${STACK_PREFIX}${userId}`;
}

function readStack(userId: string): string[] {
  try {
    const raw = sessionStorage.getItem(stackKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStack(userId: string, stack: string[]) {
  try {
    sessionStorage.setItem(stackKey(userId), JSON.stringify(stack));
  } catch {
    // storage quota exceeded — ignore
  }
}

export function clearNavStack(userId: string) {
  try {
    sessionStorage.removeItem(stackKey(userId));
  } catch {
    // ignore
  }
}

export function clearAllNavStacks() {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STACK_PREFIX)) toDelete.push(key);
    }
    toDelete.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function pushPage(userId: string, path: string) {
  const stack = readStack(userId);
  // Avoid duplicate consecutive entries
  if (stack[stack.length - 1] === path) return;
  stack.push(path);
  writeStack(userId, stack);
}

export function popPage(userId: string): string | null {
  const stack = readStack(userId);
  if (stack.length <= 1) return null; // already at root
  stack.pop();
  writeStack(userId, stack);
  return stack[stack.length - 1]; // new top = destination
}

export function peekStack(userId: string): string[] {
  return readStack(userId);
}

export function initStack(userId: string, path: string) {
  const existing = readStack(userId);
  if (existing.length === 0) {
    writeStack(userId, [path]);
  }
}
