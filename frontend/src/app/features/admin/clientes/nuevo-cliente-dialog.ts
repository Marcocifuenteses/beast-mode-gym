import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ClientesService } from '../../../core/services/clientes.service';

@Component({
  selector: 'app-nuevo-cliente-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './nuevo-cliente-dialog.html',
  styleUrl: './dialog-form.css',
})
export class NuevoClienteDialog {
  nombre = '';
  apellido = '';
  email = '';
  telefono = '';
  guardando = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly clientesService: ClientesService,
    private readonly ref: MatDialogRef<NuevoClienteDialog>,
  ) {}

  guardar(): void {
    this.error.set(null);
    this.guardando.set(true);
    this.clientesService
      .crear({ nombre: this.nombre, apellido: this.apellido, email: this.email, telefono: this.telefono || undefined })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.ref.close(true);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo crear el cliente');
        },
      });
  }
}
