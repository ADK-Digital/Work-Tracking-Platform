export {};

declare global {
  namespace Express {
    interface Request {
      authz?: {
        role: 'admin' | 'user';
      };
    }

    interface User {
      email: string;
      name: string;
      googleSub: string;
    }
  }
}
