import { classifyTask } from './trigger-source';

describe('classifyTask', () => {
  it.each([
    [{ type: 'eventTask', source: 'HTMLButtonElement.addEventListener:click' }, 'event', 'click'],
    [{ type: 'macroTask', source: 'XMLHttpRequest.send' }, 'xhr', undefined],
    [{ type: 'macroTask', source: 'setInterval' }, 'timer', undefined],
    [{ type: 'microTask', source: 'Promise.then' }, 'promise', undefined],
    [{ type: 'macroTask', source: 'weird' }, 'unknown', undefined],
  ])('%j → %s', (task, kind, detail) => {
    const t = classifyTask(task);
    expect(t.kind).toBe(kind);
    if (detail) expect(t.detail).toBe(detail);
  });
});
