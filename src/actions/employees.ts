'use server'

// TODO(M3) Employee actions — full implementation with dbAs

export interface EmployeeFormState {
  error: string | null
  fieldErrors?: Record<string, string>
}

export async function createEmployee(
  _prevState: EmployeeFormState,
  _formData: FormData
): Promise<EmployeeFormState> {
  // TODO(M3) Implement employee creation using dbAs
  return { error: 'Not implemented — coming in M3' }
}
