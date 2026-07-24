/**
 * Auth-related error types.
 */
export class PermissionDeniedError extends Error {
  public readonly permissionKey: string

  constructor(key: string) {
    super(`Permission denied: ${key}`)
    this.name = 'PermissionDeniedError'
    this.permissionKey = key
  }
}
