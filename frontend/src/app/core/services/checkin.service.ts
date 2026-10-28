import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { Aforo, CheckinResultado, HorasPico } from '../models/gym.models';

@Injectable({ providedIn: 'root' })
export class CheckinService {
  constructor(private readonly http: HttpClient) {}

  checkin(codigo: string) {
    return this.http.post<CheckinResultado>(`${API_BASE_URL}/checkin`, { codigo });
  }

  /** Check-in con el QR dinámico de la app del socio (token firmado, de un solo uso). */
  checkinQr(qr: string) {
    return this.http.post<CheckinResultado>(`${API_BASE_URL}/checkin`, { qr });
  }

  aforo() {
    return this.http.get<Aforo>(`${API_BASE_URL}/aforo`);
  }

  horasPico() {
    return this.http.get<HorasPico>(`${API_BASE_URL}/aforo/horas`);
  }
}
