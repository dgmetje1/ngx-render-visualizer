import { STYLES } from './styles';

/** The single Shadow DOM root that holds every piece of visualizer UI. */
export class UiHost {
  readonly host = document.createElement('ngx-render-visualizer');
  readonly root = this.host.attachShadow({ mode: 'open' });
  readonly overlay = document.createElement('div');
  readonly chrome = document.createElement('div');

  constructor() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.overlay.className = 'overlay';
    this.chrome.className = 'chrome';
    this.root.append(style, this.overlay, this.chrome);
    this.host.setAttribute('data-rv-ignore', '');
    document.body.append(this.host);
  }

  owns(node: Node | null): boolean {
    return !!node && (node === this.host || node.getRootNode() === this.root);
  }

  dispose(): void {
    this.host.remove();
  }
}
