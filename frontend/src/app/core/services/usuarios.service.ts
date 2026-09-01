import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { Rol } from '../models/auth.models';

export interface StaffUsuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

export interface CrearStaffInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: 'ADMIN' | 'ENTRENADOR';
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly base = `${API_BASE_URL}/usuarios`;

  constructor(private readonly http: HttpClient) {}

  listar() {
    return this.http.get<StaffUsuario[]>(this.base);
  }

  crear(data: CrearStaffInput) {
    return this.http.post<StaffUsuario>(this.base, data);
  }

  eliminar(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
