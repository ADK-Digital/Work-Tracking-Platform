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

    interface Request {
      params: Record<string, string>;
      user?: User;
      session: {
        destroy(callback: (err?: unknown) => void): void;
      };
      isAuthenticated(): boolean;
      logout(callback: (err?: unknown) => void): void;
    }
  }
}
