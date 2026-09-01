import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { MetodoPago } from '../models/gym.models';

@Injectable({ providedIn: 'root' })
export class SuscripcionesService {
  private readonly base = `${API_BASE_URL}/suscripciones`;

  constructor(private readonly http: HttpClient) {}

  crear(data: { clienteId: string; planId: string; metodoPago: MetodoPago }) {
    return this.http.post(this.base, data);
  }

  cancelar(id: string) {
    return this.http.put(`${this.base}/${id}/cancelar`, {});
  }

  actualizarDias(id: string, dias: number) {
    return this.http.put(`${this.base}/${id}/dias`, { dias });
  }
}
