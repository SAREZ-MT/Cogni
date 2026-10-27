// document-import T10 (T9b review: wall-clock assertions were flaky): a
// deterministic measure of how much string scanning a synchronous call
// does. While `work` runs, String.prototype.indexOf counts the characters
// each search walked (from its start index to the match or the end) and
// charCodeAt counts one per call; both are restored afterwards. A linear
// scanner stays within a small multiple of its input length whatever the
// machine's speed, where a quadratic one grows far past it.
export function countStringScans<T>(work: () => T): {
  result: T;
  scanned: number;
} {
  const proto = String.prototype;
  const { indexOf, charCodeAt } = proto;
  let scanned = 0;
  proto.indexOf = function (
    this: string,
    search: string,
    position?: number,
  ): number {
    const from = Math.max(0, position ?? 0);
    const at = indexOf.call(this, search, from);
    scanned += (at === -1 ? this.length : at) - from + 1;
    return at;
  };
  proto.charCodeAt = function (this: string, index: number): number {
    scanned++;
    return charCodeAt.call(this, index);
  };
  try {
    const result = work();
    return { result, scanned };
  } finally {
    proto.indexOf = indexOf;
    proto.charCodeAt = charCodeAt;
  }
}
