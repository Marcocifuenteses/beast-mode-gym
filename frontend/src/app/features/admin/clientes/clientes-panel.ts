import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ClientesService } from '../../../core/services/clientes.service';
import { RecordatoriosService } from '../../../core/services/recordatorios.service';
import { AuthService } from '../../../core/services/auth.service';
import type { ClientePanel, Semaforo } from '../../../core/models/gym.models';
import { NuevoClienteDialog } from './nuevo-cliente-dialog';
import { AsignarPlanDialog } from './asignar-plan-dialog';
import { EditarDiasDialog } from './editar-dias-dialog';

@Component({
  selector: 'app-clientes-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './clientes-panel.html',
  styleUrl: './clientes-panel.css',
})
export class ClientesPanel implements OnInit {
  clientes = signal<ClientePanel[]>([]);
  cargando = signal(true);
  busqueda = '';
  estado: Semaforo | '' = '';

  readonly columnas = ['codigo', 'nombre', 'plan', 'diasRestantes', 'estado', 'acciones'];

  constructor(
    private readonly clientesService: ClientesService,
    private readonly recordatoriosService: RecordatoriosService,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.clientesService.listar({ estado: this.estado || undefined, busqueda: this.busqueda || undefined }).subscribe({
      next: (clientes) => {
        this.clientes.set(clientes);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  esAdmin(): boolean {
    return this.auth.usuario()?.rol === 'ADMIN';
  }

  colorEstado(semaforo: Semaforo): string {
    switch (semaforo) {
      case 'VIGENTE':
        return 'verde';
      case 'POR_VENCER':
        return 'amarillo';
      case 'VENCIDA':
        return 'rojo';
      default:
        return 'gris';
    }
  }

  enviarRecordatorio(cliente: ClientePanel): void {
    if (!cliente.suscripcionId || !cliente.estado) return;
    const tipo = cliente.semaforo === 'VENCIDA' ? 'VENCIDA' : 'POR_VENCER';
    this.recordatoriosService.enviarManual(cliente.suscripcionId, tipo).subscribe({
      next: () => this.snackBar.open(`Recordatorio enviado a ${cliente.email}`, 'Cerrar', { duration: 3000 }),
      error: () => this.snackBar.open('No se pudo enviar el recordatorio', 'Cerrar', { duration: 3000 }),
    });
  }

  eliminar(cliente: ClientePanel): void {
    const confirmado = confirm(`¿Eliminar a ${cliente.nombre} ${cliente.apellido}? Esta acción lo desactiva del sistema.`);
    if (!confirmado) return;

    this.clientesService.eliminar(cliente.clienteId).subscribe({
      next: () => {
        this.snackBar.open('Cliente eliminado', 'Cerrar', { duration: 3000 });
        this.cargar();
      },
      error: () => this.snackBar.open('No se pudo eliminar el cliente', 'Cerrar', { duration: 3000 }),
    });
  }

  abrirNuevoCliente(): void {
    const ref = this.dialog.open(NuevoClienteDialog);
    ref.afterClosed().subscribe((creado) => {
      if (creado) this.cargar();
    });
  }

  abrirAsignarPlan(cliente: ClientePanel): void {
    const ref = this.dialog.open(AsignarPlanDialog, {
      data: { clienteId: cliente.clienteId, nombreCliente: `${cliente.nombre} ${cliente.apellido}` },
    });
    ref.afterClosed().subscribe((asignado) => {
      if (asignado) {
        this.snackBar.open('Plan asignado', 'Cerrar', { duration: 3000 });
        this.cargar();
      }
    });
  }

  abrirEditarDias(cliente: ClientePanel): void {
    if (!cliente.suscripcionId) return;
    const ref = this.dialog.open(EditarDiasDialog, {
      data: {
        suscripcionId: cliente.suscripcionId,
        nombreCliente: `${cliente.nombre} ${cliente.apellido}`,
        diasRestantesActual: cliente.diasRestantes ?? 0,
      },
    });
    ref.afterClosed().subscribe((actualizado) => {
      if (actualizado) {
        this.snackBar.open('Vencimiento actualizado', 'Cerrar', { duration: 3000 });
        this.cargar();
      }
    });
  }
}
