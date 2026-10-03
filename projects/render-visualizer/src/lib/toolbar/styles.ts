export const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
.overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.chrome { position: fixed; z-index: 2147483001; }

/* ---- flash boxes: colour = outcome, and the label says it in words too ---- */
.box { --c: #0ea5e9; position: fixed; border: 1.5px solid var(--c); border-radius: 3px; pointer-events: none;
  animation: fade 900ms ease-out forwards; }
.box.checked { background: color-mix(in srgb, var(--c) 7%, transparent); }
.box.rendered { --c: #ea580c; border-width: 2.5px; background: color-mix(in srgb, var(--c) 28%, transparent); }
.box.created { --c: #16a34a; border-width: 2.5px; background: color-mix(in srgb, var(--c) 26%, transparent); }
.box .tag { position: absolute; bottom: 100%; left: -2px; margin-bottom: 1px; padding: 1px 6px; background: var(--c); color: #fff;
  white-space: nowrap; font-size: 11px; font-weight: 600; border-radius: 4px; box-shadow: 0 1px 3px #0005; }
.box .tag.in { bottom: auto; top: 2px; left: 2px; margin: 0; }
.box.focus { animation: none; border-width: 3px; --c: #d97706; background: rgba(245,158,11,.18); z-index: 2; }
.box.hover { animation: none; --c: #6366f1; border-width: 2px; background: rgba(99,102,241,.14); }
.box.op { border-style: dashed; animation-duration: 700ms; --c: #ea580c; }
@keyframes fade { 0% { opacity: 1 } 70% { opacity: .85 } 100% { opacity: 0 } }

/* ---- banner: one line that says what just happened ---- */
.banner { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); max-width: min(760px, calc(100vw - 32px));
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 6px 12px; border-radius: 999px;
  background: #0f172af0; color: #f1f5f9; box-shadow: 0 4px 16px #0006; pointer-events: none; transition: opacity .4s; }
.banner.hidden { opacity: 0; }
.banner b { color: #fff; }
.pill { display: inline-flex; gap: 4px; align-items: center; padding: 0 8px; border-radius: 999px; font-weight: 600; color: #fff; }
.pill.checked { background: #0ea5e9; } .pill.rendered { background: #ea580c; } .pill.created { background: #16a34a; }
.pill.skipped { background: #475569; }
.pill.zero { opacity: .4; }

/* ---- toolbar: status line on top, controls below ---- */
.toolbar { position: fixed; left: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 6px;
  max-width: calc(100vw - 32px); padding: 8px 12px; background: #0f172af2; color: #e5e7eb; border-radius: 10px;
  box-shadow: 0 4px 16px #0006; cursor: grab; user-select: none; }
.toolbar .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.toolbar .status { font-size: 12.5px; }
.toolbar .status b { color: #fff; }
.toolbar label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
.toolbar button { background: #334155; color: #e5e7eb; border: 0; border-radius: 5px; padding: 3px 9px; cursor: pointer; }
.toolbar button:hover { background: #475569; }
.toolbar button.on { background: #2563eb; color: #fff; }
.toolbar input[type=range] { width: 120px; }
.group { display: flex; gap: 6px; align-items: center; padding-right: 10px; border-right: 1px solid #334155; }
.group:last-child { border-right: 0; padding-right: 0; }
.group > .name { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
.muted { color: #94a3b8; }
.hud { gap: 14px; padding: 4px 8px; background: #1e293b; border-radius: 6px; }
.metric { display: inline-flex; gap: 5px; align-items: baseline; font-variant-numeric: tabular-nums; }
.metric .name { color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
.metric b { color: #f8fafc; }

/* ---- tree panel ---- */
.panel { position: fixed; top: 0; right: 0; width: 320px; max-height: calc(100vh - 110px); overflow: auto; background: #0f172af2;
  color: #e2e8f0; padding: 8px; border-bottom-left-radius: 10px; box-shadow: -4px 0 16px #0006; }
.panel.collapsed { width: auto; }
.panel .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.panel h4 { margin: 2px 0; font-size: 13px; color: #f8fafc; }
.panel .sub { color: #94a3b8; padding: 0 0 6px; }
.panel .sub strong { color: #e2e8f0; }
.panel .summary { display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0 8px; }
.panel button.mini { background: #334155; color: #e2e8f0; border: 0; border-radius: 4px; padding: 0 7px; cursor: pointer; }
.node { display: flex; gap: 6px; align-items: center; padding: 2px 4px; border-radius: 4px; white-space: nowrap; cursor: default; }
.node:hover { background: #1e293b; }
.node.checked { color: #38bdf8; } .node.rendered { color: #fb923c; font-weight: 600; } .node.created { color: #4ade80; font-weight: 600; }
.node.skipped { color: #64748b; } .node.current { background: #78350f; }
.node.more { color: #94a3b8; cursor: pointer; font-style: italic; } .node.more:hover { color: #e2e8f0; }
.badge { font-size: 10px; padding: 0 5px; border-radius: 8px; background: #334155; color: #cbd5e1; }
.badge.Eager { background: #7c2d12; } .badge.OnPush { background: #14532d; }
.ops { margin: 8px 0 0; padding: 6px; background: #1e293b; border-radius: 6px; max-height: 160px; overflow: auto; }
.ops h4 { font-size: 11px; color: #94a3b8; }
.empty { color: #64748b; padding: 6px; }
`;
