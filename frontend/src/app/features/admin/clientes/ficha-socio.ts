import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientesService } from '../../../core/services/clientes.service';
import { CheckinService } from '../../../core/services/checkin.service';
import { SuscripcionesService } from '../../../core/services/suscripciones.service';
import { RecordatoriosService } from '../../../core/services/recordatorios.service';
import { AuthService } from '../../../core/services/auth.service';
import type { ClienteCompleto, ClientePanel, MetodoPago } from '../../../core/models/gym.models';
import { estadoMembresia, fechaCorta, formatoQ, iniciales } from '../../../shared/estado';
import { AsignarPlanDialog } from './asignar-plan-dialog';
import { EditarDiasDialog } from './editar-dias-dialog';

export interface FichaSocioData {
  cliente: ClientePanel;
}

const DIA_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-ficha-socio',
  standalone: true,
  templateUrl: './ficha-socio.html',
  styleUrl: './ficha-socio.css',
})
export class FichaSocio implements OnInit {
  private readonly data = inject<FichaSocioData>(MAT_BOTTOM_SHEET_DATA);
  private readonly ref = inject<MatBottomSheetRef<FichaSocio>>(MatBottomSheetRef);
  private readonly clientesService = inject(ClientesService);
  private readonly checkinService = inject(CheckinService);
  private readonly suscripcionesService = inject(SuscripcionesService);
  private readonly recordatoriosService = inject(RecordatoriosService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);

  readonly fechaCorta = fechaCorta;
  readonly formatoQ = formatoQ;

  /** La lista se recarga al cerrar la ficha solo si algo cambió. */
  huboCambios = false;

  // Arranca con la fila de la lista (se muestra al instante) y se completa con el detalle.
  cliente = signal<ClientePanel | ClienteCompleto>(this.data.cliente);
  procesando = signal(false);
  renovando = signal(false);
  metodoPago = signal<MetodoPago>('EFECTIVO');
  confirmarEliminar = signal(false);
  error = signal<string | null>(null);

  readonly esAdmin = computed(() => this.auth.usuario()?.rol === 'ADMIN');
  readonly esEntrenador = computed(() => this.auth.usuario()?.rol === 'ENTRENADOR');
  readonly estado = computed(() => estadoMembresia(this.cliente()));
  readonly iniciales = computed(() => iniciales(this.cliente().nombre, this.cliente().apellido));

  /** Suscripción mostrada en el panel (la más reciente no cancelada), con su plan completo. */
  readonly suscripcion = computed(() => {
    const c = this.cliente();
    if (!('historialSuscripciones' in c) || !c.suscripcionId) return null;
    return c.historialSuscripciones.find((s) => s.id === c.suscripcionId) ?? null;
  });

  readonly puedeEntrar = computed(() => {
    const c = this.cliente();
    return c.dentro || c.semaforo === 'VIGENTE' || c.semaforo === 'POR_VENCER';
  });

  /** Vista previa de la renovación: si sigue vigente se suma desde el vencimiento, si no desde hoy. */
  readonly renovacion = computed(() => {
    const s = this.suscripcion();
    const c = this.cliente();
    if (!s || !c.fechaFin) return null;
    const vigente = (c.diasRestantes ?? -1) >= 0 && c.estado === 'ACTIVA';
    const hoy = new Date();
    const base = vigente ? new Date(c.fechaFin) : new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
    return {
      plan: s.plan.nombre,
      precio: s.plan.precio,
      disponible: s.plan.activo,
      vigente,
      hasta: new Date(base.getTime() + s.plan.duracionDias * DIA_MS),
    };
  });

  ngOnInit(): void {
    this.recargar();
  }

  private recargar(): void {
    this.clientesService.obtener(this.data.cliente.clienteId).subscribe({
      next: (detalle) => this.cliente.set(detalle),
      error: () => this.error.set('No se pudo cargar el detalle del socio'),
    });
  }

  private marcarCambio(mensaje: string): void {
    this.huboCambios = true;
    this.snackBar.open(mensaje, 'Cerrar', { duration: 3000 });
    this.recargar();
  }

  private mensajeError(err: unknown, porDefecto: string): string {
    return err instanceof HttpErrorResponse && err.error?.error ? err.error.error : porDefecto;
  }

  registrarEntradaSalida(): void {
    this.error.set(null);
    this.procesando.set(true);
    this.checkinService.checkin(this.cliente().codigo).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.cliente.update((c) => ({ ...c, dentro: r.accion === 'ENTRADA' }));
        this.marcarCambio(`${r.accion === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada: ${r.cliente.nombre}`);
      },
      error: (err) => {
        this.procesando.set(false);
        this.error.set(this.mensajeError(err, 'No se pudo registrar'));
      },
    });
  }

  confirmarRenovacion(): void {
    const id = this.cliente().suscripcionId;
    if (!id) return;
    this.error.set(null);
    this.procesando.set(true);
    this.suscripcionesService.renovar(id, this.metodoPago()).subscribe({
      next: () => {
        this.procesando.set(false);
        this.renovando.set(false);
        this.marcarCambio('Membresía renovada');
      },
      error: (err) => {
        this.procesando.set(false);
        this.error.set(this.mensajeError(err, 'No se pudo renovar'));
      },
    });
  }

  asignarPlan(): void {
    const c = this.cliente();
    this.dialog
      .open(AsignarPlanDialog, { data: { clienteId: c.clienteId, nombreCliente: `${c.nombre} ${c.apellido}` } })
      .afterClosed()
      .subscribe((asignado) => {
        if (asignado) this.marcarCambio('Plan asignado');
      });
  }

  editarDias(): void {
    const c = this.cliente();
    if (!c.suscripcionId) return;
    this.dialog
      .open(EditarDiasDialog, {
        data: {
          suscripcionId: c.suscripcionId,
          nombreCliente: `${c.nombre} ${c.apellido}`,
          diasRestantesActual: c.diasRestantes ?? 0,
        },
      })
      .afterClosed()
      .subscribe((actualizado) => {
        if (actualizado) this.marcarCambio('Vencimiento actualizado');
      });
  }

  enviarRecordatorio(): void {
    const c = this.cliente();
    if (!c.suscripcionId) return;
    const tipo = c.semaforo === 'VENCIDA' ? 'VENCIDA' : 'POR_VENCER';
    this.recordatoriosService.enviarManual(c.suscripcionId, tipo).subscribe({
      next: () => this.snackBar.open(`Recordatorio enviado a ${c.email}`, 'Cerrar', { duration: 3000 }),
      error: (err) => this.error.set(this.mensajeError(err, 'No se pudo enviar el recordatorio')),
    });
  }

  eliminar(): void {
    if (!this.confirmarEliminar()) {
      this.confirmarEliminar.set(true);
      return;
    }
    this.clientesService.eliminar(this.cliente().clienteId).subscribe({
      next: () => {
        this.huboCambios = true;
        this.snackBar.open('Socio eliminado', 'Cerrar', { duration: 3000 });
        this.ref.dismiss();
      },
      error: (err) => {
        this.confirmarEliminar.set(false);
        this.error.set(this.mensajeError(err, 'No se pudo eliminar el socio'));
      },
    });
  }

  cerrar(): void {
    this.ref.dismiss();
  }
}
