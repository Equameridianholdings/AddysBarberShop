import { Routes } from '@angular/router';
import { Que } from './que/que';
import { Reporting } from './reporting/reporting';

export const routes: Routes = [

   { path: 'que', component: Que}, // Your Home/Queue page
  { path: 'reporting', component: Reporting }, // The new Reporting page
  { path: '', redirectTo: 'que', pathMatch: 'full' }, // Redirect base URL to Queue
  { path: '**', redirectTo: 'que' }
 
];
