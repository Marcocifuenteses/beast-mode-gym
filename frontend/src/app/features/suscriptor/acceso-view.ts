import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { toDataURL } from 'qrcode';
import { ClientesService } from '../../core/services/clientes.service';
import type { ClientePanel } from '../../core/models/gym.models';
import { estadoMembresia } from '../../shared/estado';

/** Se pide un QR nuevo cuando al actual le quedan estos segundos. */
const MARGEN_RENOVACION_S = 15;

/**
 * Pestaña "Acceso": el socio muestra este QR en la entrada y el entrenador lo
 * escanea. El QR es un token firmado que caduca en segundos y solo sirve una
 * vez, así que se regenera solo; una captura de pantalla no sirve después.
 */
@Component({
  selector: 'app-acceso-view',
  standalone: true,
  templateUrl: './acceso-view.html',
  styleUrl: './acceso-view.css',
})
export class AccesoView implements OnInit, OnDestroy {
  imagenQr = signal<string | null>(null);
  codigo = signal<string | null>(null);
  error = signal<string | null>(null);
  perfil = signal<ClientePanel | null>(null);
  /** Segundos hasta que se genere el siguiente QR. */
  restante = signal(0);
  cicloTotal = signal(1);

  readonly progreso = computed(() => Math.max(0, Math.min(100, (this.restante() / this.cicloTotal()) * 100)));

  /** Aviso si la membresía no permite entrar: el QR se muestra igual, pero el check-in lo rechazará. */
  readonly aviso = computed(() => {
    const p = this.perfil();
    if (!p) return null;
    if (p.semaforo === 'SIN_PLAN') return 'No tienes un plan activo: pasa a recepción antes de entrar.';
    if (p.semaforo === 'VENCIDA') return 'Tu membresía está vencida: renuévala en recepción para poder entrar.';
    if (p.semaforo === 'POR_VENCER') return `Tu membresía ${estadoMembresia(p).texto.toLowerCase()}.`;
    return null;
  });

  private renovarEn = 0;
  private pidiendo = false;
  private tickId?: ReturnType<typeof setInterval>;

  constructor(private readonly clientesService: ClientesService) {}

  ngOnInit(): void {
    this.pedirQr();
    this.tickId = setInterval(() => this.tick(), 1000);
    this.clientesService.miPerfil().subscribe({ next: (p) => this.perfil.set(p.perfil) });
  }

  ngOnDestroy(): void {
    if (this.tickId) clearInterval(this.tickId);
  }

  // Al volver a la app (p. ej. tras bloquear el teléfono) el QR puede haber caducado.
  @HostListener('document:visibilitychange')
  alCambiarVisibilidad(): void {
    if (document.visibilityState === 'visible' && Date.now() >= this.renovarEn) this.pedirQr();
  }

  pedirQr(): void {
    if (this.pidiendo) return;
    this.pidiendo = true;
    this.clientesService.miQr().subscribe({
      next: async (qr) => {
        // Se calcula con el reloj local (no con expiraEn del servidor) para no
        // depender de que el reloj del teléfono esté bien sincronizado.
        const ciclo = Math.max(5, qr.vigenciaSegundos - MARGEN_RENOVACION_S);
        this.renovarEn = Date.now() + ciclo * 1000;
        this.cicloTotal.set(ciclo);
        this.restante.set(ciclo);
        this.codigo.set(qr.codigo);
        try {
          // Siempre oscuro sobre blanco (también en modo oscuro): es lo que mejor leen las cámaras.
          // Corrección de errores baja: en una pantalla el QR no se ensucia ni se rompe, y así
          // sale menos denso y se lee más rápido.
          this.imagenQr.set(
            await toDataURL(qr.token, {
              width: 320,
              margin: 2,
              errorCorrectionLevel: 'L',
              color: { dark: '#172120', light: '#ffffff' },
            }),
          );
          this.error.set(null);
        } catch {
          this.error.set('No se pudo dibujar el QR');
        }
        this.pidiendo = false;
      },
      error: () => {
        this.pidiendo = false;
        this.imagenQr.set(null);
        this.error.set('No se pudo generar tu QR. Revisa tu conexión.');
        this.renovarEn = Date.now() + 10_000; // reintento automático
      },
    });
  }

  private tick(): void {
    const s = Math.max(0, Math.ceil((this.renovarEn - Date.now()) / 1000));
    this.restante.set(s);
    if (s === 0 && document.visibilityState === 'visible') this.pedirQr();
  }
}
