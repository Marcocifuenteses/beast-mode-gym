import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, output, signal } from '@angular/core';
import jsQR from 'jsqr';

/** Cada cuántos ms se analiza un cuadro del video (no hace falta hacerlo a 60 fps). */
const INTERVALO_LECTURA_MS = 120;
/** Ancho máximo del cuadro que se analiza: más grande solo hace la lectura más lenta. */
const ANCHO_ANALISIS = 640;

/**
 * Abre la cámara (la trasera en teléfonos) y emite el texto de cada QR que
 * detecta. Emite en cada cuadro en que vea un QR: quien lo use debe ignorar
 * lecturas repetidas.
 */
@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  template: `
    <div class="visor">
      <video #video playsinline muted></video>
      @if (estado() === 'activa') {
        <div class="marco" aria-hidden="true"></div>
      } @else if (estado() === 'abriendo') {
        <p class="msg">Abriendo cámara…</p>
      } @else {
        <p class="msg error">
          <span class="material-icons" aria-hidden="true">videocam_off</span>
          {{ error() }}
        </p>
      }
    </div>
  `,
  styles: `
    .visor {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      max-height: 60vh;
      border-radius: 14px;
      overflow: hidden;
      background: #0b0f0e;
      display: grid;
      place-items: center;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .marco {
      position: absolute;
      inset: 18%;
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: 18px;
      box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.35);
    }
    .msg {
      position: relative;
      margin: 0;
      padding: 16px;
      color: #e6ece9;
      text-align: center;
      display: grid;
      justify-items: center;
      gap: 6px;
      font-size: 14px;
    }
    .msg .material-icons {
      font-size: 36px;
      opacity: 0.7;
    }
  `,
})
export class QrScanner implements AfterViewInit, OnDestroy {
  @ViewChild('video', { static: true }) private videoRef!: ElementRef<HTMLVideoElement>;

  readonly leido = output<string>();

  estado = signal<'abriendo' | 'activa' | 'error'>('abriendo');
  error = signal('');

  private stream?: MediaStream;
  private frameId?: number;
  private ultimaLectura = 0;
  private destruido = false;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d', { willReadFrequently: true });

  async ngAfterViewInit(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fallar(
        window.isSecureContext
          ? 'Este navegador no permite usar la cámara.'
          : 'La cámara solo funciona con https (o en localhost). Usa el campo de código mientras tanto.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      // Si el componente se cerró mientras se pedía el permiso, se suelta la cámara.
      if (this.destruido) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const video = this.videoRef.nativeElement;
      video.srcObject = stream;
      await video.play();
      this.estado.set('activa');
      this.frameId = requestAnimationFrame(this.analizar);
    } catch (err) {
      const nombre = err instanceof DOMException ? err.name : '';
      this.fallar(
        nombre === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.'
          : nombre === 'NotFoundError' || nombre === 'OverconstrainedError'
            ? 'No se encontró ninguna cámara en este dispositivo.'
            : nombre === 'NotReadableError'
              ? 'La cámara está siendo usada por otra aplicación.'
              : 'No se pudo abrir la cámara.',
      );
    }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.stream?.getTracks().forEach((t) => t.stop());
  }

  private fallar(mensaje: string): void {
    this.error.set(mensaje);
    this.estado.set('error');
  }

  private readonly analizar = (ahora: number): void => {
    this.frameId = requestAnimationFrame(this.analizar);
    if (ahora - this.ultimaLectura < INTERVALO_LECTURA_MS) return;
    this.ultimaLectura = ahora;

    const video = this.videoRef.nativeElement;
    if (!this.ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;

    const escala = Math.min(1, ANCHO_ANALISIS / video.videoWidth);
    const w = Math.round(video.videoWidth * escala);
    const h = Math.round(video.videoHeight * escala);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(video, 0, 0, w, h);

    const codigo = jsQR(this.ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    if (codigo?.data) this.leido.emit(codigo.data);
  };
}
