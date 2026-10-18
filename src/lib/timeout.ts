/** Rejection reason of withTimeout; `code` maps to Thai text with submitErrorMessageTh. */
export class TimeoutError extends Error {
  readonly code = "request_timeout";
  constructor() {
    super("request_timeout");
    this.name = "TimeoutError";
  }
}

/** Settles like `promise`, or rejects with TimeoutError after `ms` (the work itself is not cancelled). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
