// Only backend failures are eligible for automatic CPU retry.
export class GpuBackendError extends Error {
  constructor(message, options) { super(message, options); this.name = 'GpuBackendError'; }
}
