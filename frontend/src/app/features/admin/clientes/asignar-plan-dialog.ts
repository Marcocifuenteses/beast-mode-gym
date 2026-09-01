import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { PlanesService } from '../../../core/services/planes.service';
import { SuscripcionesService } from '../../../core/services/suscripciones.service';
import type { Plan, MetodoPago } from '../../../core/models/gym.models';

export interface AsignarPlanDialogData {
  clienteId: string;
  nombreCliente: string;
}

@Component({
  selector: 'app-asignar-plan-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  templateUrl: './asignar-plan-dialog.html',
  styleUrl: './dialog-form.css',
})
export class AsignarPlanDialog implements OnInit {
  readonly data = inject<AsignarPlanDialogData>(MAT_DIALOG_DATA);

  planes = signal<Plan[]>([]);
  planId = '';
  metodoPago: MetodoPago = 'EFECTIVO';
  guardando = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly planesService: PlanesService,
    private readonly suscripcionesService: SuscripcionesService,
    private readonly ref: MatDialogRef<AsignarPlanDialog>,
  ) {}

  ngOnInit(): void {
    this.planesService.listar().subscribe((planes) => this.planes.set(planes));
  }

  guardar(): void {
    if (!this.planId) return;
    this.error.set(null);
    this.guardando.set(true);
    this.suscripcionesService
      .crear({ clienteId: this.data.clienteId, planId: this.planId, metodoPago: this.metodoPago })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.ref.close(true);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo asignar el plan');
        },
      });
  }
}
