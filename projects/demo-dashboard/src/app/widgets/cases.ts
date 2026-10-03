import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

// ---- Case 1: mutate vs replace an OnPush input -------------------------------------------------

interface Person {
  name: string;
  visits: number;
}

@Component({
  selector: 'app-person-card',
  template: `<div class="mini"><strong>{{ person().name }}</strong> · child sees {{ person().visits }} visits</div>`,
})
export class PersonCard {
  readonly person = input.required<Person>();
}

@Component({
  selector: 'app-mutation-case',
  imports: [PersonCard],
  template: `
    <p>Parent model: <strong>{{ person.visits }}</strong> visits</p>
    <app-person-card [person]="person" />
    <div class="row">
      <button (click)="person.visits = person.visits + 1">Mutate in place</button>
      <button (click)="person = { ...person, visits: person.visits + 1 }">Replace the object</button>
    </div>
  `,
})
export class MutationCase {
  person: Person = { name: 'Ada', visits: 0 };
}

// ---- Case 2: signal vs plain field in an OnPush component -----------------------------------------

@Component({
  selector: 'app-field-counter',
  template: `<div class="mini">plain field: <strong>{{ value }}</strong>
    <button (click)="0">click inside (marks me dirty)</button></div>`,
})
export class FieldCounter {
  value = 0;
}

@Component({
  selector: 'app-signal-counter',
  template: `<div class="mini">signal: <strong>{{ value() }}</strong></div>`,
})
export class SignalCounter {
  readonly value = signal(0);
}

@Component({
  selector: 'app-signal-case',
  imports: [FieldCounter, SignalCounter],
  template: `
    <app-field-counter #field />
    <app-signal-counter #sig />
    <div class="row"><button (click)="bump(field, sig)">Increment both</button></div>
  `,
})
export class SignalCase {
  bump(field: FieldCounter, sig: SignalCounter): void {
    field.value++;
    sig.value.update((v) => v + 1);
  }
}

// ---- Case 3: a click deep in the tree marks only its ancestors dirty -----------------------------

@Component({
  selector: 'app-branch',
  template: `
    <div class="branch">
      <button (click)="clicks.update((n) => n + 1)">L{{ depth() }} · {{ clicks() }}</button>
      @if (depth() < 3) {
        <div class="kids"><app-branch [depth]="depth() + 1" /><app-branch [depth]="depth() + 1" /></div>
      }
    </div>
  `,
})
export class Branch {
  readonly depth = input(1);
  protected readonly clicks = signal(0);
}

// ---- Case 4: track by id vs track by index -------------------------------------------------------------------

export interface Item {
  id: number;
  label: string;
}

@Component({
  selector: 'app-list-by-id',
  template: `<ul class="mini">@for (i of items(); track i.id) { <li>{{ i.label }}</li> }</ul>`,
})
export class ListById {
  readonly items = input.required<Item[]>();
}

@Component({
  selector: 'app-list-by-index',
  template: `<ul class="mini">@for (i of items(); track $index) { <li>{{ i.label }}</li> }</ul>`,
})
export class ListByIndex {
  readonly items = input.required<Item[]>();
}

@Component({
  selector: 'app-track-case',
  imports: [ListById, ListByIndex],
  template: `
    <div class="two"><div><small>track item.id</small><app-list-by-id [items]="items()" /></div>
      <div><small>track $index</small><app-list-by-index [items]="items()" /></div></div>
    <div class="row"><button (click)="prepend()">Prepend an item</button></div>
    <p class="muted">Tree panel → step through: by-id writes 1 node, by-index rewrites every row.</p>
  `,
})
export class TrackCase {
  private next = 4;
  protected readonly items = signal<Item[]>([1, 2, 3].map((id) => ({ id, label: `Item ${id}` })));

  prepend(): void {
    const id = this.next++;
    this.items.update((l) => [{ id, label: `Item ${id}` }, ...l].slice(0, 8));
  }
}

// ---- Case 5: components created on demand ------------------------------------------------------------------

@Component({ selector: 'app-note', template: `<div class="mini">I was just created</div>` })
export class Note {}

@Component({
  selector: 'app-create-case',
  imports: [Note],
  template: `
    @if (show()) { <app-note /> } @else { <div class="mini muted">nothing here</div> }
    <div class="row"><button (click)="show.set(!show())">{{ show() ? 'Destroy' : 'Create' }} component</button></div>
  `,
})
export class CreateCase {
  protected readonly show = signal(false);
}

// ---- Case 6: batching vs many cycles --------------------------------------------------------------------------------

@Component({
  selector: 'app-batch-case',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="mini">count: <strong>{{ count() }}</strong> · cycles caused: see toolbar</p>
    <div class="row">
      <button (click)="batch()">20 writes at once</button>
      <button (click)="spread()">20 writes, one per timer</button>
    </div>
    <p class="muted">The first is one cycle; the second is twenty (try the slow slider).</p>
  `,
})
export class BatchCase {
  protected readonly count = signal(0);

  batch(): void {
    for (let i = 0; i < 20; i++) this.count.update((n) => n + 1);
  }

  spread(): void {
    for (let i = 0; i < 20; i++) setTimeout(() => this.count.update((n) => n + 1), i * 150);
  }
}
