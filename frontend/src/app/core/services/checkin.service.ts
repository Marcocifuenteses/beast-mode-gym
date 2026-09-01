import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { CheckinResultado } from '../models/gym.models';

@Injectable({ providedIn: 'root' })
export class CheckinService {
  constructor(private readonly http: HttpClient) {}

  checkin(codigo: string) {
    return this.http.post<CheckinResultado>(`${API_BASE_URL}/checkin`, { codigo });
  }

  aforo() {
    return this.http.get<{ personasDentro: number }>(`${API_BASE_URL}/aforo`);
  }
}
