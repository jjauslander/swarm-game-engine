import { runtime, defaultPackageId } from "../composition/index.ts";
import { localCatalog, identify, unpack } from "./local-catalog.ts";
import { Application, Graphics, Text, Container } from "pixi.js";
import {
  create,
  submit,
  view,
  snapshot,
  restore,
  decisionOwner,
  copy,
  stable,
  tile,
} from "../composition/index.ts";
import { choose } from "./simple-bot.ts";
import "./style.css";
const el = (id: string) => document.getElementById(id)!;
let catalog: any[] = [],
  selected = 0,
  state: any = null,
  p: any = null,
  currentView: any = null,
  seat = "",
  matchId = "",
  network = false,
  bots = new Set<string>(),
  paused = false,
  stage: any = null,
  selectedEntity = "",
  routes: any[] = [],
  audio: AudioContext | null = null,
  muted = localStorage.getItem("muted") !== "false",
  volume = Number(localStorage.getItem("volume") ?? 30),
  eventSeq = 0;
const voices = new Set<OscillatorNode>();
function silence() {
  for (const voice of voices) {
    try {
      voice.stop();
    } catch {}
  }
  voices.clear();
}
let live: any = null;
let boardResizeObserver: ResizeObserver | null = null;
let cachedFrame: any = null;
let app: Application | null = null,
  world: Container | null = null,
  zoom = 1,
  pan = { x: 0, y: 0 },
  poll: any,
  busy = false;
const colors = [
  "#68caff",
  "#ff786c",
  "#a5df78",
  "#e9b3ff",
  "#ffc66d",
  "#69e0ce",
];
el("app").innerHTML =
  '<header><h1>Swarm Game Engine</h1><button id="home">Mods</button><button id="pause">Pause bots</button><button id="sound">Sound</button><label>Volume <input id="volume" type="range" min="0" max="100" value="' +
  volume +
  '"></label></header><div id="menu"></div><div id="status"></div><div id="error" role="alert"></div><div id="board"></div><div id="controls"></div>';
function error(e: any) {
  el("error").textContent = e.message ?? String(e);
}
async function api(path: string, body?: any) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(seat ? { Authorization: "Bearer " + seat } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.message);
  return j;
}
function sound(type: string) {
  if (muted || !audio || document.hidden) return;
  const configuredCue = p?.presentation.sounds?.[type];
  if (!configuredCue) return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "sine";
  const cue = p?.presentation.sounds?.[type];
  o.frequency.value = cue?.frequency ?? 185;
  const duration = cue?.duration ?? 0.17;
  g.gain.setValueAtTime((volume / 100) * 0.12, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(
    0.001,
    audio.currentTime + duration - 0.01,
  );
  o.connect(g);
  g.connect(audio.destination);
  voices.add(o);
  while (voices.size > 12) {
    const oldest = voices.values().next().value!;
    try {
      oldest.stop();
    } catch {}
    voices.delete(oldest);
  }
  o.onended = () => {
    voices.delete(o);
    o.disconnect();
    g.disconnect();
  };
  o.start();
  o.stop(audio.currentTime + duration);
}
el("sound").onclick = async () => {
  muted = !muted;
  localStorage.setItem("muted", String(muted));
  if (muted) silence();
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {}
  el("sound").textContent = muted ? "Enable sound" : "Mute sound";
};
(el("volume") as HTMLInputElement).oninput = (e) => {
  volume = Number((e.target as HTMLInputElement).value);
  localStorage.setItem("volume", String(volume));
  if (!volume) silence();
};
el("pause").onclick = async () => {
  paused = !paused;
  if (network) {
    try {
      await api("bots", { id: matchId, paused });
    } catch (e) {
      error(e);
    }
  }
  el("pause").textContent = paused ? "Resume bots" : "Pause bots";
};
function stop() {
  boardResizeObserver?.disconnect();
  boardResizeObserver = null;
  clearInterval(poll);
  poll = null;
  stage = null;
  selectedEntity = "";
  app?.destroy(true, { children: true, texture: true });
  app = null;
  world = null;
  el("board").replaceChildren();
  silence();
  void audio?.suspend();
}
el("home").onclick = () => {
  if (app)
    live = {
      state,
      p,
      network,
      seat,
      matchId,
      selected,
      bots: new Set(bots),
      paused,
      currentView,
    };
  stop();
  showMenu();
};
async function init() {
  try {
    catalog = await api("packages");
  } catch {
    catalog = await localCatalog();
  }
  selected = Math.max(
    0,
    catalog.findIndex((x) => x.package.id === defaultPackageId),
  );
  const requested = new URLSearchParams(location.search).get("package");
  if (requested) {
    const i = catalog.findIndex((x) => x.digest === requested);
    if (i >= 0) selected = i;
  }
  showMenu();
  const saved = localStorage.getItem("networkSeat");
  if (saved) {
    const j = JSON.parse(saved);
    el("menu").append(
      Object.assign(document.createElement("button"), {
        textContent: "Reconnect last seat",
        onclick: () => join(j),
      }),
    );
  }
}
function showMenu() {
  el("board").style.display = "none";
  el("status").textContent = "Choose a game package";
  el("controls").replaceChildren();
  el("menu").style.display = "block";
  el("menu").innerHTML =
    '<h2>Mods</h2><select id="packages"></select><p id="help"></p><label>Players <input id="count" type="number" min="2" max="6" value="2"></label><div id="players"></div><div id="allocation"></div><button id="local">Play locally</button><button id="host">Create network match</button><label>Import package <input id="import" type="file" accept=".hexmod"></label><label>Load local save <input id="load" type="file" accept=".json"></label><details><summary>Join network seat</summary><textarea id="join-data" aria-label="Seat connection JSON"></textarea><button id="join">Join</button></details><details><summary>AI modding</summary>Run npm run mcp in this checkout as a local stdio companion. See docs/Modding_Guide.md for agent configuration.</details>';
  if (live) {
    const back = document.createElement("button");
    back.textContent = "Return to game";
    back.onclick = async () => {
      ({
        state,
        p,
        network,
        seat,
        matchId,
        selected,
        bots,
        paused,
        currentView,
      } = live);
      if (network) {
        const saved = JSON.parse(localStorage.getItem("networkSeat") ?? "null");
        if (saved) await join(saved);
      } else {
        await board();
        refresh();
      }
    };
    el("menu").prepend(back);
  }
  const select = el("packages") as HTMLSelectElement;
  catalog.forEach((x, i) => select.add(new Option(x.package.name, String(i))));
  select.value = String(selected);
  const config = () => {
    p = catalog[selected].package;
    el("help").textContent = p.help;
    const descriptor = runtime.resolve(p).setup;
    const countInput = el("count") as HTMLInputElement;
    countInput.min = String(descriptor.minPlayers);
    countInput.max = String(descriptor.maxPlayers);
    const count = Math.max(
      descriptor.minPlayers,
      Math.min(descriptor.maxPlayers, Number(countInput.value)),
    );
    countInput.value = String(count);
    countInput.disabled = descriptor.minPlayers === descriptor.maxPlayers;
    el("players").innerHTML = Array.from(
      { length: count },
      (_, i) =>
        "<label>Player " +
        (i + 1) +
        ' <select id="controller' +
        i +
        '"><option value="human">Human</option><option value="bot" ' +
        (i ? "selected" : "") +
        ">Bot</option></select></label>",
    ).join("");
    el("allocation").innerHTML = p.areas
      .filter((a) => !a.shared)
      .map(
        (a, i) =>
          "<label>" +
          descriptor.areaLabel +
          " " +
          a.id +
          ' <select data-area="' +
          a.id +
          '">' +
          (descriptor.allowUnused ? '<option value="">Unused</option>' : "") +
          Array.from(
            { length: count },
            (_, j) =>
              '<option value="p' +
              (j + 1) +
              '" ' +
              (i === j ? "selected" : "") +
              ">Player " +
              (j + 1) +
              "</option>",
          ).join("") +
          "</select></label>",
      )
      .join("");
  };
  select.onchange = () => {
    selected = Number(select.value);
    config();
  };
  (el("count") as HTMLInputElement).onchange = config;
  config();
  const setup = () => {
    const owners: any = {};
    document.querySelectorAll<HTMLSelectElement>("[data-area]").forEach((s) => {
      if (s.value) owners[s.dataset.area!] = s.value;
    });
    bots = new Set(
      [
        ...document.querySelectorAll<HTMLSelectElement>("[id^=controller]"),
      ].flatMap((s, i) => (s.value === "bot" ? ["p" + (i + 1)] : [])),
    );
    return owners;
  };
  el("local").onclick = async () => {
    try {
      network = false;
      seat = "";
      const owners = setup();
      state = create(
        p,
        catalog[selected].digest,
        owners,
        12345,
        false,
        Object.fromEntries(
          [...new Set(Object.values(owners))].map((id) => [
            id,
            bots.has(id as string) ? "bot" : "human",
          ]),
        ),
      );
      eventSeq = state.events.at(-1)?.seq ?? 0;
      await board();
      refresh();
    } catch (e) {
      error(e);
    }
  };
  el("host").onclick = async () => {
    try {
      const r = await api("create", {
        digest: catalog[selected].digest,
        owners: setup(),
        seed: 12345,
        bots: [...bots],
      });
      el("menu").innerHTML = "<h2>Share one seat with each participant</h2>";
      for (const s of r.seats) {
        const j = {
          id: r.id,
          token: s.token,
          player: s.player,
          digest: catalog[selected].digest,
        };
        const area = document.createElement("textarea");
        area.value = JSON.stringify(j);
        el("menu").append(area);
        const b = document.createElement("button");
        b.textContent = "Join " + s.player;
        b.onclick = () => join(j);
        el("menu").append(b);
      }
    } catch (e) {
      error(e);
    }
  };
  (el("import") as HTMLInputElement).onchange = async (e) => {
    try {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const bytes = new Uint8Array(await f.arrayBuffer());
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      const imported = unpack(bytes);
      const installed = JSON.parse(
        localStorage.getItem("installedPackages") ?? "[]",
      );
      const existing = [...installed, ...catalog.map((x) => x.package)].find(
        (x) => x.id === imported.id && x.version === imported.version,
      );
      if (existing && stable(existing) !== stable(imported))
        throw Error("Version already installed with different content");
      if (!existing) installed.push(imported);
      localStorage.setItem("installedPackages", JSON.stringify(installed));
      catalog = await localCatalog();
      showMenu();
    } catch (e) {
      error(e);
    }
  };
  (el("load") as HTMLInputElement).onchange = async (e) => {
    try {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const loaded = restore(p, catalog[selected].digest, await f.text());
      network = false;
      state = loaded;
      bots = new Set(
        Object.entries(loaded.controllers)
          .filter(([id, c]) => c === "bot")
          .map(([id]) => id),
      );
      eventSeq = loaded.events.at(-1)?.seq ?? 0;
      await board();
      refresh();
    } catch (e) {
      error(e);
    }
  };
  el("join").onclick = () => {
    try {
      void join(
        JSON.parse((el("join-data") as HTMLTextAreaElement).value),
      ).catch(error);
    } catch (e) {
      error(e);
    }
  };
}
async function join(j: any) {
  seat = j.token;
  matchId = j.id;
  network = true;
  bots.clear();
  selected = catalog.findIndex((x) => x.digest === j.digest);
  if (selected < 0) throw Error("Install matching package");
  p = catalog[selected].package;
  runtime.resolve(p);
  currentView = await api("view", { id: matchId, digest: j.digest });
  eventSeq = currentView.events.at(-1)?.seq ?? 0;
  localStorage.setItem("networkSeat", JSON.stringify(j));
  await board();
  refresh();
  poll = setInterval(async () => {
    if (busy) return;
    try {
      const next = await api("view", { id: matchId, digest: j.digest });
      if (
        !busy &&
        next.revision >= currentView.revision &&
        (next.revision !== currentView.revision ||
          next.botsPaused !== currentView.botsPaused)
      ) {
        currentView = next;
        refresh();
      }
    } catch (e) {
      error(e);
    }
  }, 500);
}
async function command(c: any) {
  if (busy) return;
  c = c.command ?? c;
  busy = true;
  for (const control of el("controls").querySelectorAll<
    HTMLButtonElement | HTMLSelectElement
  >("button,select"))
    control.disabled = true;
  let failure: unknown = null;
  try {
    if (network) {
      await api("command", {
        id: matchId,
        requestId: crypto.randomUUID(),
        revision: currentView.revision,
        command: c,
      });
      currentView = await api("view", { id: matchId });
    } else
      state = submit(p, state, decisionOwner(state), {
        matchId: state.id,
        revision: state.revision,
        command: c,
      });
    stage = null;
    selectedEntity = "";
  } catch (e) {
    failure = e;
  } finally {
    busy = false;
    refresh();
    if (failure) error(failure);
  }
}
function refresh() {
  if (!app) return;
  const who = network ? "" : decisionOwner(state);
  if (!network) currentView = view(p, state, who);
  const v = currentView;
  if (network) {
    paused = v.botsPaused;
    el("pause").textContent = paused ? "Resume bots" : "Pause bots";
  }
  el("error").textContent = "";
  el("status").textContent = p.name + " · " + v.status;
  for (const e of v.events)
    if (e.seq > eventSeq) {
      sound(e.type);
      eventSeq = e.seq;
    }
  el("controls").innerHTML =
    '<button id="end">End activation</button><button id="undo">Undo</button><button id="finish">Finish move</button><button id="cancel">Cancel preview</button><button id="focus">Focus area</button><button id="recenter">Recenter</button>' +
    (!network
      ? '<button id="save">Save</button>'
      : "<span>Network undo disabled</span>") +
    '<div id="choices"></div><details><summary>Game log / rules</summary><p id="rules"></p><div id="log"></div></details>';
  const primary = v.controls.find((c) => c.primary);
  (el("end") as HTMLButtonElement).disabled = !primary || !!stage;
  (el("undo") as HTMLButtonElement).disabled = !v.canUndo;
  el("end").textContent = primary?.label ?? "End activation";
  el("end").onclick = () => primary && command(primary);
  el("focus").textContent = v.labels.focus;
  el("undo").onclick = () => command({ type: "undo" });
  el("finish").hidden = el("cancel").hidden =
    !stage && !v.controls.some((c) => c.staged);
  (el("finish") as HTMLButtonElement).disabled = !stage?.stop;
  el("finish").onclick = () => command(stage.stop);
  el("cancel").onclick = () => {
    stage = null;
    selectedEntity = "";
    refresh();
  };
  el("recenter").onclick = () => {
    pan = { x: 0, y: 0 };
    zoom = 1;
    draw();
  };
  el("focus").onclick = () => {
    const ts = v.tiles.filter((t) => v.focusTiles.includes(t.id));
    const t = ts[Math.floor(ts.length / 2)];
    if (!t) return;
    zoom = 1.6;
    pan = {
      x: (frame().x - Math.sqrt(3) * 28 * (t.q + t.r / 2)) * scale(),
      y: (frame().y - 42 * t.r) * scale(),
    };
    draw();
  };
  if (!network)
    el("save").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([snapshot(p, state)], { type: "application/json" }),
      );
      a.download = "game-save.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  el("rules").textContent = p.help;
  el("log").textContent = v.events
    .map((e) => e.type + " " + JSON.stringify(e.data))
    .join("\n");
  if (!v.decision) {
    const actors = [
      ...new Set(
        v.controls.filter((c) => c.kind === "route").map((c) => c.actor),
      ),
    ];
    const picker = document.createElement("select");
    picker.setAttribute("aria-label", v.labels.select);
    picker.add(new Option(v.labels.select, ""));
    actors.forEach((id: any) => picker.add(new Option(id, id)));
    picker.value = selectedEntity;
    picker.onchange = () => {
      selectedEntity = picker.value;
      stage = null;
      refresh();
    };
    el("choices").append(picker);
    if (selectedEntity) {
      const legal = v.controls.filter(
        (c) => c.kind === "route" && c.actor === selectedEntity,
      );
      const route = document.createElement("select");
      route.setAttribute("aria-label", "Movement route");
      legal.forEach((c, i) =>
        route.add(new Option(c.route.join(" → "), String(i))),
      );
      el("choices").append(route);
      const b = document.createElement("button");
      b.textContent = "Move selected route";
      b.disabled = !legal.length;
      b.onclick = () => command(legal[Number(route.value)]);
      el("choices").append(b);
    }
  }
  if (v.decision) {
    if (v.decision.options.length) {
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Decision options");
      for (const o of v.decision.options) select.add(new Option(o.label, o.id));
      el("choices").append(select);
      const b = document.createElement("button");
      b.textContent = "Confirm choice";
      b.onclick = () =>
        command(v.decision.options.find((o) => o.id === select.value).command);
      el("choices").append(b);
    }
  } else {
    for (const c of v.controls.filter(
      (c) =>
        c.kind === "button" &&
        !c.primary &&
        (!c.actor || !selectedEntity || c.actor === selectedEntity),
    )) {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.onclick = () => command(c);
      el("choices").append(b);
    }
  }
  draw();
}
async function board() {
  if (!muted) void audio?.resume();
  cachedFrame = null;
  el("menu").style.display = "none";
  el("board").style.display = "block";
  app?.destroy(true, { children: true });
  app = new Application();
  await app.init({
    resizeTo: el("board"),
    background: p.presentation.background,
    antialias: true,
  });
  app.canvas.setAttribute("aria-label", "Hex game board");
  el("board").append(app.canvas);
  boardResizeObserver?.disconnect();
  boardResizeObserver = new ResizeObserver(() => {
    if (app) {
      app.renderer.resize(el("board").clientWidth, el("board").clientHeight);
      draw();
    }
  });
  boardResizeObserver.observe(el("board"));
  world = new Container();
  app.stage.addChild(world);
  pan = { x: 0, y: 0 };
  zoom = 1;
  let drag: any = null;
  app.canvas.onpointerdown = (e) => {
    drag = { x: e.clientX, y: e.clientY, pan: { ...pan }, moved: false };
    app!.canvas.setPointerCapture(e.pointerId);
  };
  app.canvas.onpointermove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) {
      pan = { x: drag.pan.x + dx, y: drag.pan.y + dy };
      draw();
    }
  };
  app.canvas.onpointerup = (e) => {
    if (drag && !drag.moved) {
      const rect = app!.canvas.getBoundingClientRect(),
        x =
          (e.clientX - rect.left - app!.screen.width / 2 - pan.x) / scale() +
          frame().x,
        y =
          (e.clientY - rect.top - app!.screen.height / 2 - pan.y) / scale() +
          frame().y;
      const t = [...currentView.tiles].sort(
        (a, b) =>
          Math.hypot(Math.sqrt(3) * 28 * (a.q + a.r / 2) - x, 42 * a.r - y) -
          Math.hypot(Math.sqrt(3) * 28 * (b.q + b.r / 2) - x, 42 * b.r - y),
      )[0];
      if (t) tap(t.id);
    }
    drag = null;
  };
  app.canvas.onwheel = (e) => {
    e.preventDefault();
    zoom = Math.max(0.5, Math.min(3, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    draw();
  };
  window.onresize = () => draw();
}
function frame() {
  if (cachedFrame) return cachedFrame;
  const ts = currentView?.tiles ?? [];
  const xs = ts.map((t) => Math.sqrt(3) * 28 * (t.q + t.r / 2)),
    ys = ts.map((t) => 42 * t.r);
  const minX = Math.min(...xs) - 40,
    maxX = Math.max(...xs) + 40,
    minY = Math.min(...ys) - 40,
    maxY = Math.max(...ys) + 40;
  return (cachedFrame = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  });
}
const scale = () =>
  Math.min(
    (app?.screen.width ?? 800) / frame().width,
    (app?.screen.height ?? 600) / frame().height,
  ) * zoom;
function tap(t: string) {
  const v = currentView;
  if (network) {
    paused = v.botsPaused;
    el("pause").textContent = paused ? "Resume bots" : "Pause bots";
  }
  if (v.decision) {
    const option = v.decision.options.find((o) => o.target === t);
    if (option) void command(option.command);
    return;
  }
  if (stage) {
    const c = stage.continuations.find((c) => c.route.at(-1) === t);
    if (c) {
      void command(c);
      return;
    }
  }
  const possible = v.controls.filter(
    (c) =>
      c.kind === "route" && c.actor === selectedEntity && c.route.at(-1) === t,
  );
  const near = v.controls.filter(
    (c) => c.kind === "route" && c.actor === selectedEntity && c.route[0] === t,
  );
  if (selectedEntity && near.some((c) => c.staged) && near.length && !stage) {
    stage = {
      first: t,
      stop: near.find((c) => c.route.length === 1),
      continuations: near.filter((c) => c.route.length > 1),
    };
    refresh();
    return;
  }
  if (possible.length) {
    if (possible.length === 1) void command(possible[0]);
    else {
      el("choices").replaceChildren();
      possible.forEach((c) => {
        const b = document.createElement("button");
        b.textContent = "Route " + c.route.join(" → ");
        b.onclick = () => command(c);
        el("choices").append(b);
      });
    }
    return;
  }
  const e = Object.values(v.entities).find(
    (e: any) =>
      e.tile === t && !e.hidden && v.controls.some((c) => c.actor === e.id),
  ) as any;
  if (e) {
    if (stage) {
      if (stage.stop) {
        const chosen = e.id;
        void command(stage.stop).then(() => {
          selectedEntity = chosen;
          refresh();
        });
      } else
        error(
          Error(
            "Complete the highlighted departure before selecting another piece",
          ),
        );
      return;
    }
    selectedEntity = e.id;
    stage = null;
    refresh();
  }
}
function draw() {
  if (!app || !world || !currentView) return;
  app.canvas.dataset.cells = JSON.stringify(
    currentView.tiles.map((t) => ({
      id: t.id,
      x:
        app!.screen.width / 2 +
        pan.x +
        (Math.sqrt(3) * 28 * (t.q + t.r / 2) - frame().x) * scale(),
      y: app!.screen.height / 2 + pan.y + (42 * t.r - frame().y) * scale(),
    })),
  );
  world.removeChildren().forEach((c) => c.destroy());
  world.position.set(
    app.screen.width / 2 + pan.x - frame().x * scale(),
    app.screen.height / 2 + pan.y - frame().y * scale(),
  );
  world.scale.set(scale());
  const v = currentView;
  if (network) {
    paused = v.botsPaused;
    el("pause").textContent = paused ? "Resume bots" : "Pause bots";
  }
  routes =
    stage?.continuations ??
    v.controls.filter((c) => c.kind === "route" && c.actor === selectedEntity);
  for (const t of v.tiles) {
    const x = Math.sqrt(3) * 28 * (t.q + t.r / 2),
      y = 42 * t.r,
      g = new Graphics();
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = ((30 + i * 60) * Math.PI) / 180;
      return [x + 27 * Math.cos(a), y + 27 * Math.sin(a)];
    }).flat();
    const highlighted =
      routes.some((c) => c.route.at(-1) === t.id) ||
      (v.decision && v.decision.options.some((o) => o.target === t.id));
    const col = highlighted ? "#779f72" : (v.tileColors[t.id] ?? "#334455");
    g.poly(pts)
      .fill(col)
      .stroke({
        color: highlighted ? "#fce69e" : "#a88b59",
        width: highlighted ? 3 : 1,
      });
    world.addChild(g);
  }
  if (selectedEntity) {
    const e = v.entities[selectedEntity],
      candidates = routes.slice(0, 20);
    for (const c of candidates) {
      let prev = tile(p, e.tile);
      for (const id of c.route) {
        const t = tile(p, id),
          g = new Graphics();
        g.moveTo(Math.sqrt(3) * 28 * (prev.q + prev.r / 2), 42 * prev.r)
          .lineTo(Math.sqrt(3) * 28 * (t.q + t.r / 2), 42 * t.r)
          .stroke({ color: "#e3e09a", width: 1, alpha: 0.35 });
        world.addChild(g);
        prev = t;
      }
    }
  }
  for (const e of Object.values(v.entities) as any[]) {
    if (e.hidden) continue;
    const t = tile(p, stage && e.id === selectedEntity ? stage.first : e.tile),
      x = Math.sqrt(3) * 28 * (t.q + t.r / 2),
      y = 42 * t.r,
      player = e.owner,
      g = new Graphics();
    g.circle(x, y, 19)
      .fill("#17201c")
      .stroke({
        color: colors[Number(player?.slice(1) ?? 1) - 1] ?? "#ddd",
        width: e.id === selectedEntity ? 4 : 2,
      });
    world.addChild(g);
    const text = new Text({
      text: e.symbol,
      style: { fontSize: 26, fill: "#f7d791" },
    });
    text.anchor.set(0.5);
    text.position.set(x, y);
    world.addChild(text);
    const badgeValue =
      stage && e.id === selectedEntity
        ? ((stage.stop ?? stage.continuations[0])?.previewBadge ?? e.badge)
        : e.badge;
    if (badgeValue) {
      const badge = new Text({
        text: String(badgeValue),
        style: { fontSize: 13, fill: "#fff" },
      });
      badge.position.set(x + 10, y + 6);
      world.addChild(badge);
    }
  }
}
setInterval(async () => {
  if (
    !app ||
    network ||
    paused ||
    busy ||
    stage ||
    !state ||
    state.outcome ||
    !bots.has(decisionOwner(state))
  )
    return;
  const c = choose(p, state);
  if (c) await command(c);
}, 250);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    silence();
    void audio?.suspend();
  } else if (!muted && app) void audio?.resume();
});
void init().catch(error);
