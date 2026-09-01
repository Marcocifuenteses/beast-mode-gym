import type { RolUsuario } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: bigint;
        rol: RolUsuario;
      };
    }
  }
}

export {};
