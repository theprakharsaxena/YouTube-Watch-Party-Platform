// Small token bucket used per socket connection.
export function createRateLimiter({ capacity, refillPerSecond }, now = () => Date.now()) {
  let tokens = capacity;
  let last = now();
  return function tryConsume() {
    const current = now();
    tokens = Math.min(capacity, tokens + ((current - last) / 1000) * refillPerSecond);
    last = current;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}
