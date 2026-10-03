import { Component } from '@angular/core';
import { Branch, BatchCase, CreateCase, MutationCase, SignalCase, TrackCase } from '../widgets/cases';

@Component({
  selector: 'app-cases',
  imports: [MutationCase, SignalCase, Branch, TrackCase, CreateCase, BatchCase],
  template: `
    <p class="intro">Small experiments, one behavior each. Click, then watch the colors: <span class="chip c1">checked</span>
      <span class="chip c2">re-rendered</span> <span class="chip c3">created</span> and the “caused by” line in the toolbar.</p>
    <div class="cases">
      <section class="panel-box"><h2>1 · Mutate vs replace an OnPush input</h2>
        <p class="muted">Mutating in place does not change the input reference, so the child is skipped. Replace the object and it updates.</p>
        <app-mutation-case /></section>
      <section class="panel-box"><h2>2 · Signal vs plain field (OnPush)</h2>
        <p class="muted">The signal write marks its component for refresh. The plain field changes silently until something else marks it dirty.</p>
        <app-signal-case /></section>
      <section class="panel-box"><h2>3 · A click marks its ancestors dirty</h2>
        <p class="muted">Click a deep button: only that branch up to the root is checked; sibling branches are skipped.</p>
        <app-branch /></section>
      <section class="panel-box"><h2>4 · track by id vs by index</h2>
        <p class="muted">Same data, different DOM work. Compare the number of DOM ops for each list.</p>
        <app-track-case /></section>
      <section class="panel-box"><h2>5 · Creating components</h2>
        <p class="muted">New component instances flash green on their first cycle.</p>
        <app-create-case /></section>
      <section class="panel-box"><h2>6 · Batching vs many cycles</h2>
        <app-batch-case /></section>
    </div>
  `,
})
export class Cases {}
