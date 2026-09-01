import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { guestGuard } from './core/guards/guest.guard';
import { homeRedirectGuard } from './core/guards/home-redirect.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'panel',
    canActivate: [authGuard, roleGuard('ADMIN', 'ENTRENADOR')],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/admin/clientes/clientes-panel').then((m) => m.ClientesPanel),
      },
      {
        path: 'checkin',
        canActivate: [roleGuard('ENTRENADOR')],
        loadComponent: () => import('./features/admin/checkin/checkin').then((m) => m.Checkin),
      },
      {
        path: 'staff',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/admin/staff/staff-panel').then((m) => m.StaffPanel),
      },
    ],
  },
  {
    path: 'mi-cuenta',
    canActivate: [authGuard, roleGuard('SUSCRIPTOR')],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/suscriptor/suscriptor-view').then((m) => m.SuscriptorView),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
