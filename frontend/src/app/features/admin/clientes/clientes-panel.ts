import { Component, OnInit, computed, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ClientesService } from '../../../core/services/clientes.service';
import type { ClientePanel } from '../../../core/models/gym.models';
import { estadoMembresia, fechaCorta, iniciales } from '../../../shared/estado';
import { NuevoClienteDialog } from './nuevo-cliente-dialog';
import { FichaSocio, type FichaSocioData } from './ficha-socio';

type Filtro = 'todos' | 'dentro' | 'porvencer' | 'vencidas' | 'sinplan';

const FILTROS: { clave: Filtro; etiqueta: string }[] = [
  { clave: 'todos', etiqueta: 'Todos' },
  { clave: 'dentro', etiqueta: 'En el gym' },
  { clave: 'porvencer', etiqueta: 'Por vencer' },
  { clave: 'vencidas', etiqueta: 'Vencidas' },
  { clave: 'sinplan', etiqueta: 'Sin plan' },
];

@Component({
  selector: 'app-clientes-panel',
  standalone: true,
  templateUrl: './clientes-panel.html',
  styleUrl: './clientes-panel.css',
})
export class ClientesPanel implements OnInit {
  readonly filtros = FILTROS;
  readonly estadoMembresia = estadoMembresia;
  readonly fechaCorta = fechaCorta;
  readonly iniciales = iniciales;

  clientes = signal<ClientePanel[]>([]);
  cargando = signal(true);
  error = signal(false);
  busqueda = signal('');
  filtro = signal<Filtro>('todos');

  // La lista completa de un gimnasio es pequeña: se carga una vez y se filtra
  // en el navegador, así la búsqueda responde al instante mientras se escribe.
  readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.clientes().filter((c) => {
      if (q && !`${c.nombre} ${c.apellido} ${c.codigo} ${c.email}`.toLowerCase().includes(q)) return false;
      switch (this.filtro()) {
        case 'dentro':
          return c.dentro;
        case 'porvencer':
          return c.semaforo === 'POR_VENCER';
        case 'vencidas':
          return c.semaforo === 'VENCIDA';
        case 'sinplan':
          return c.semaforo === 'SIN_PLAN';
        default:
          return true;
      }
    });
  });

  readonly conteos = computed(() => {
    const l = this.clientes();
    return {
      todos: l.length,
      dentro: l.filter((c) => c.dentro).length,
      porvencer: l.filter((c) => c.semaforo === 'POR_VENCER').length,
      vencidas: l.filter((c) => c.semaforo === 'VENCIDA').length,
      sinplan: l.filter((c) => c.semaforo === 'SIN_PLAN').length,
    } satisfies Record<Filtro, number>;
  });

  constructor(
    private readonly clientesService: ClientesService,
    private readonly dialog: MatDialog,
    private readonly sheet: MatBottomSheet,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.clientesService.listar().subscribe({
      next: (clientes) => {
        this.clientes.set(clientes);
        this.error.set(false);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  buscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  abrirFicha(cliente: ClientePanel): void {
    const ref = this.sheet.open<FichaSocio, FichaSocioData>(FichaSocio, {
      data: { cliente },
      panelClass: 'ficha-sheet',
      ariaLabel: `Ficha de ${cliente.nombre} ${cliente.apellido}`,
    });
    ref.afterDismissed().subscribe(() => {
      if (ref.instance.huboCambios) this.cargar();
    });
  }

  abrirNuevoCliente(): void {
    const ref = this.dialog.open(NuevoClienteDialog);
    ref.afterClosed().subscribe((creado) => {
      if (creado) this.cargar();
    });
  }
}
