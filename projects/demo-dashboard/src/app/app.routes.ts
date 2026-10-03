import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard';

export const routes: Routes = [
  { path: '', component: Dashboard, title: 'Dashboard' },
  { path: 'cases', loadComponent: () => import('./pages/cases').then((m) => m.Cases), title: 'Cases' },
  { path: 'stress', loadComponent: () => import('./pages/stress').then((m) => m.Stress), title: 'Stress' },
  { path: 'settings', loadComponent: () => import('./pages/settings').then((m) => m.Settings), title: 'Settings' },
];
