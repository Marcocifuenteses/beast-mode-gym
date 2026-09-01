import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { SuscripcionesService } from '../../../core/services/suscripciones.service';

export interface EditarDiasDialogData {
  suscripcionId: string;
  nombreCliente: string;
  diasRestantesActual: number;
}

@Component({
  selector: 'app-editar-dias-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './editar-dias-dialog.html',
  styleUrl: './dialog-form.css',
})
export class EditarDiasDialog {
  readonly data = inject<EditarDiasDialogData>(MAT_DIALOG_DATA);

  dias = this.data.diasRestantesActual;
  guardando = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly suscripcionesService: SuscripcionesService,
    private readonly ref: MatDialogRef<EditarDiasDialog>,
  ) {}

  guardar(): void {
    this.error.set(null);
    this.guardando.set(true);
    this.suscripcionesService.actualizarDias(this.data.suscripcionId, this.dias).subscribe({
      next: () => {
        this.guardando.set(false);
        this.ref.close(true);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(err.error?.error ?? 'No se pudo actualizar');
      },
    });
  }
}
