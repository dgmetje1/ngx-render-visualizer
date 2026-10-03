import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './widgets/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  template: `<app-header /><main><router-outlet /></main>`,
})
export class App {}
