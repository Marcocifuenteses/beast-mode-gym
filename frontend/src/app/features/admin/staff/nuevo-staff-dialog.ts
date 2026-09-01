import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { UsuariosService } from '../../../core/services/usuarios.service';

@Component({
  selector: 'app-nuevo-staff-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './nuevo-staff-dialog.html',
  styleUrl: '../clientes/dialog-form.css',
})
export class NuevoStaffDialog {
  nombre = '';
  apellido = '';
  email = '';
  password = '';
  rol: 'ADMIN' | 'ENTRENADOR' = 'ENTRENADOR';
  guardando = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly ref: MatDialogRef<NuevoStaffDialog>,
  ) {}

  guardar(): void {
    this.error.set(null);
    this.guardando.set(true);
    this.usuariosService
      .crear({ nombre: this.nombre, apellido: this.apellido, email: this.email, password: this.password, rol: this.rol })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.ref.close(true);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo crear la cuenta');
        },
      });
  }
}
