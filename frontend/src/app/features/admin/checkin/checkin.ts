import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CheckinService } from '../../../core/services/checkin.service';
import type { CheckinResultado } from '../../../core/models/gym.models';

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './checkin.html',
  styleUrl: './checkin.css',
})
export class Checkin {
  @ViewChild('campoCodigo') campoCodigo?: ElementRef<HTMLInputElement>;

  codigo = '';
  resultado = signal<CheckinResultado | null>(null);
  error = signal<string | null>(null);
  procesando = signal(false);

  constructor(private readonly checkinService: CheckinService) {}

  escanear(): void {
    if (!this.codigo.trim()) return;
    this.error.set(null);
    this.resultado.set(null);
    this.procesando.set(true);

    this.checkinService.checkin(this.codigo.trim()).subscribe({
      next: (r) => {
        this.resultado.set(r);
        this.procesando.set(false);
        this.codigo = '';
        this.campoCodigo?.nativeElement.focus();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'No se pudo procesar el código');
        this.procesando.set(false);
        this.codigo = '';
        this.campoCodigo?.nativeElement.focus();
      },
    });
  }
}
