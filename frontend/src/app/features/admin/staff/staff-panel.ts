import { Component, OnInit, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { UsuariosService, type StaffUsuario } from '../../../core/services/usuarios.service';
import { AuthService } from '../../../core/services/auth.service';
import { iniciales } from '../../../shared/estado';
import { NuevoStaffDialog } from './nuevo-staff-dialog';

@Component({
  selector: 'app-staff-panel',
  standalone: true,
  templateUrl: './staff-panel.html',
  styleUrl: './staff-panel.css',
})
export class StaffPanel implements OnInit {
  readonly iniciales = iniciales;

  staff = signal<StaffUsuario[]>([]);
  cargando = signal(true);
  /** Id de la cuenta que espera el segundo toque para confirmar la desactivación. */
  confirmando = signal<string | null>(null);

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.usuariosService.listar().subscribe({
      next: (staff) => {
        this.staff.set(staff);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  esUnoMismo(usuario: StaffUsuario): boolean {
    return this.auth.usuario()?.id === usuario.id;
  }

  abrirNuevo(): void {
    const ref = this.dialog.open(NuevoStaffDialog);
    ref.afterClosed().subscribe((creado) => {
      if (creado) this.cargar();
    });
  }

  desactivar(usuario: StaffUsuario): void {
    if (this.confirmando() !== usuario.id) {
      this.confirmando.set(usuario.id);
      return;
    }
    this.confirmando.set(null);
    this.usuariosService.eliminar(usuario.id).subscribe({
      next: () => {
        this.snackBar.open('Cuenta desactivada', 'Cerrar', { duration: 3000 });
        this.cargar();
      },
      error: (err) => this.snackBar.open(err.error?.error ?? 'No se pudo desactivar', 'Cerrar', { duration: 3000 }),
    });
  }
}
