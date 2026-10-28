import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CheckinService } from '../../../core/services/checkin.service';
import type { CheckinResultado } from '../../../core/models/gym.models';
import { QrScanner } from '../../../shared/qr-scanner';

/** La cámara ve el mismo QR en muchos cuadros seguidos: se ignora si se repite dentro de este lapso. */
const IGNORAR_REPETIDO_MS = 5000;
const CLAVE_CAMARA = 'checkin.camara';

/** Los QR de la app del socio son JWT (tres partes separadas por puntos); un código escrito no. */
function esTokenQr(valor: string): boolean {
  return valor.length > 40 && valor.split('.').length === 3;
}

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [FormsModule, QrScanner],
  templateUrl: './checkin.html',
  styleUrl: './checkin.css',
})
export class Checkin {
  @ViewChild('campoCodigo') campoCodigo?: ElementRef<HTMLInputElement>;

  codigo = '';
  resultado = signal<CheckinResultado | null>(null);
  error = signal<string | null>(null);
  procesando = signal(false);
  camara = signal(this.leerPreferenciaCamara());

  private ultimoLeido = '';
  private ultimoLeidoEn = 0;

  constructor(private readonly checkinService: CheckinService) {}

  alternarCamara(): void {
    this.camara.update((v) => !v);
    try {
      localStorage.setItem(CLAVE_CAMARA, String(this.camara()));
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda la preferencia.
    }
  }

  /** Envío del formulario: código escrito a mano o QR leído por un lector USB (que "teclea" el token). */
  escanear(): void {
    const valor = this.codigo.trim();
    if (!valor) return;
    this.codigo = '';
    this.procesar(valor);
  }

  alLeerQr(valor: string): void {
    const ahora = Date.now();
    if (this.procesando() || (valor === this.ultimoLeido && ahora - this.ultimoLeidoEn < IGNORAR_REPETIDO_MS)) return;
    this.ultimoLeido = valor;
    this.ultimoLeidoEn = ahora;
    this.procesar(valor);
  }

  private procesar(valor: string): void {
    this.error.set(null);
    this.resultado.set(null);
    this.procesando.set(true);

    const peticion = esTokenQr(valor) ? this.checkinService.checkinQr(valor) : this.checkinService.checkin(valor);
    peticion.subscribe({
      next: (r) => {
        this.resultado.set(r);
        this.procesando.set(false);
        navigator.vibrate?.(80);
        this.enfocarCampo();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'No se pudo procesar el código');
        this.procesando.set(false);
        navigator.vibrate?.([60, 60, 60]);
        this.enfocarCampo();
      },
    });
  }

  // Con la cámara activa no se enfoca el campo: en el teléfono abriría el teclado encima del visor.
  private enfocarCampo(): void {
    if (!this.camara()) this.campoCodigo?.nativeElement.focus();
  }

  private leerPreferenciaCamara(): boolean {
    try {
      return localStorage.getItem(CLAVE_CAMARA) === 'true';
    } catch {
      return false;
    }
  }
}
