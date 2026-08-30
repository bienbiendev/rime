export type User = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isStaff?: boolean;
  isSuperAdmin?: boolean;
};
