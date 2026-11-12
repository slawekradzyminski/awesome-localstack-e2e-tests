/** 400 body of field validation: field name (or "error") to message. */
export type ValidationErrors = Record<string, string>;

export type IdentityIssue =
  | 'USERNAME_FORMAT'
  | 'USERNAME_CASE_DUPLICATE'
  | 'USERNAME_IS_ANOTHER_USERS_EMAIL'
  | 'EMAIL_INVALID'
  | 'EMAIL_NOT_CANONICAL'
  | 'EMAIL_CASE_DUPLICATE';

/** GET /api/v1/admin/users/identity-issues item: an account that predates the identity rules. */
export interface UserIdentityIssueDto {
  id: number;
  username: string;
  email: string;
  issues: IdentityIssue[];
}
