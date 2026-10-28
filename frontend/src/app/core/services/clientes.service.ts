import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { ClienteCompleto, ClientePanel, PerfilSuscriptor, QrAcceso } from '../models/gym.models';

export interface CrearClienteInput {
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  telefono?: string;
  dpi?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly base = `${API_BASE_URL}/clientes`;

  constructor(private readonly http: HttpClient) {}

  listar(filtros: { estado?: string; busqueda?: string } = {}) {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.busqueda) params = params.set('busqueda', filtros.busqueda);
    return this.http.get<ClientePanel[]>(this.base, { params });
  }

  obtener(id: string) {
    return this.http.get<ClienteCompleto>(`${this.base}/${id}`);
  }

  crear(data: CrearClienteInput) {
    return this.http.post<ClienteCompleto>(this.base, data);
  }

  actualizar(id: string, data: Partial<CrearClienteInput>) {
    return this.http.put<ClienteCompleto>(`${this.base}/${id}`, data);
  }

  eliminar(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  miPerfil() {
    return this.http.get<PerfilSuscriptor>(`${this.base}/me/perfil`);
  }

  miQr() {
    return this.http.get<QrAcceso>(`${this.base}/me/qr`);
  }
}
