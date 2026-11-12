export interface UserRegisterDto {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserEditDto {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

