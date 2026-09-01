import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { DashboardResumen } from '../models/gym.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  obtener() {
    return this.http.get<DashboardResumen>(`${API_BASE_URL}/dashboard`);
  }
}
