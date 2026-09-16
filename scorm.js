const MAX_PARENT_SEARCH = 10;

function apiFromWindow(startWindow) {
  let current = startWindow;
  let depth = 0;

  while (current && depth < MAX_PARENT_SEARCH) {
    try {
      if (current.API) return current.API;
      if (current.parent === current) break;
      current = current.parent;
    } catch {
      break;
    }
    depth += 1;
  }

  return null;
}

export function findScormApi(startWindow) {
  if (!startWindow) return null;
  const parentApi = apiFromWindow(startWindow);
  if (parentApi) return parentApi;

  try {
    return apiFromWindow(startWindow.opener);
  } catch {
    return null;
  }
}

export class ScormRuntime {
  constructor(api = null) {
    this.api = api;
    this.connected = false;
    this.finished = false;
  }

  initialize() {
    if (!this.api || this.connected) return this.connected;
    this.connected = this.api.LMSInitialize('') === 'true';
    return this.connected;
  }

  get(name) {
    if (!this.connected) return '';
    return this.api.LMSGetValue(name) ?? '';
  }

  set(name, value) {
    if (!this.connected) return false;
    return this.api.LMSSetValue(name, String(value)) === 'true';
  }

  commit() {
    return this.connected && this.api.LMSCommit('') === 'true';
  }

  status() {
    return this.get('cmi.core.lesson_status');
  }

  score() {
    const value = Number(this.get('cmi.core.score.raw'));
    return Number.isFinite(value) ? value : 0;
  }

  loadState() {
    const serialized = this.get('cmi.suspend_data');
    if (!serialized) return null;

    try {
      return JSON.parse(serialized);
    } catch {
      return null;
    }
  }

  beginAttempt(state) {
    if (!this.connected) return false;
    this.set('cmi.core.score.min', 0);
    this.set('cmi.core.score.max', 20);
    this.set('cmi.core.lesson_status', 'incomplete');
    this.set('cmi.core.exit', 'suspend');
    return this.saveState(state);
  }

  saveState(state) {
    if (!this.connected) return false;
    this.set('cmi.suspend_data', JSON.stringify(state));
    this.set('cmi.core.lesson_location', String(state.index ?? 0));
    return this.commit();
  }

  suspend(state) {
    if (!this.connected) return false;
    this.set('cmi.core.exit', 'suspend');
    return this.saveState(state);
  }

  complete(score, state) {
    if (!this.connected) return false;
    this.set('cmi.suspend_data', JSON.stringify(state));
    this.set('cmi.core.lesson_location', String(state.index ?? 4));
    this.set('cmi.core.score.min', 0);
    this.set('cmi.core.score.max', 20);
    this.set('cmi.core.score.raw', score);
    this.set('cmi.core.lesson_status', 'completed');
    this.set('cmi.core.exit', '');
    return this.commit();
  }

  finish() {
    if (!this.connected || this.finished) return false;
    this.finished = this.api.LMSFinish('') === 'true';
    return this.finished;
  }
}

export function connectScorm(startWindow) {
  const runtime = new ScormRuntime(findScormApi(startWindow));
  runtime.initialize();
  return runtime;
}
