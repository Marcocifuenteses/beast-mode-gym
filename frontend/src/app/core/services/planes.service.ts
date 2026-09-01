import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-config';
import type { Plan } from '../models/gym.models';

@Injectable({ providedIn: 'root' })
export class PlanesService {
  private readonly base = `${API_BASE_URL}/planes`;

  constructor(private readonly http: HttpClient) {}

  listar() {
    return this.http.get<Plan[]>(this.base);
  }
}
