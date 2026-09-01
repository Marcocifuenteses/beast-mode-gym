import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';

@Injectable({ providedIn: 'root' })
export class RecordatoriosService {
  constructor(private readonly http: HttpClient) {}

  enviarManual(suscripcionId: string, tipo: 'POR_VENCER' | 'VENCIDA') {
    return this.http.post(`${API_BASE_URL}/recordatorios/enviar`, { suscripcionId, tipo });
  }
}
