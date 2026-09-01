export type Rol = 'ADMIN' | 'ENTRENADOR' | 'SUSCRIPTOR';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
}

export interface LoginResponse {
  accessToken: string;
  user: Usuario;
}
