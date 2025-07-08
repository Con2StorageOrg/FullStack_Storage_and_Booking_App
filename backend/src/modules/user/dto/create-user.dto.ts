export class CreateUserDto {
  email: string;
  password: string;
  full_name: string;
  visible_name?: string;
  phone?: string;
  role?: string;
  preferences?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * It might be worth defining the possible preferences once we know what they are
   */
}
