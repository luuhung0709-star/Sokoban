/**
 * A hand-rolled fake DOM, shared by every view-layer test.
 *
 * Why not jsdom: the project forbids dependencies — `web/package.json` declares no
 * `dependencies` and no `devDependencies`, and that constraint is the whole reason the
 * game has no build step. So the tests fake exactly the slice of the DOM the view code
 * touches and nothing more.
 *
 * What it deliberately does NOT model: layout, CSS, real event bubbling, or attribute
 * reflection. Anything that depends on those is not testable this way and is still
 * checked by eye in a browser.
 */

/**
 * Matches the trivial selectors the view layer actually uses: `.class`, `#id`, and a
 * bare tag name. Anything more complex is a sign the production code got fancier than
 * this fake can follow, so it throws rather than silently returning null — a silent
 * null here would surface as a confusing "cannot read property of null" far away.
 */
function matches(node, selector) {
  if (selector.startsWith('.')) {
    return String(node.className).split(/\s+/).includes(selector.slice(1));
  }
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (/^[a-zA-Z]+$/.test(selector)) return node.tagName === selector.toLowerCase();
  throw new Error(`fakeDom: selector too complex for the fake: ${selector}`);
}

export function makeElement(tag = 'div') {
  const listeners = new Map();

  return {
    tagName: String(tag).toLowerCase(),
    id: '',
    className: '',
    type: '',
    src: '',
    alt: '',
    disabled: false,
    hidden: false,
    dataset: {},
    attributes: {},
    style: { setProperty(k, v) { this[k] = v; } },
    children: [],

    // Production code uses `el.textContent = ''` to empty a container, so assigning
    // has to drop the children too, not just the text.
    set textContent(value) {
      this._text = String(value);
      if (value === '') this.children = [];
    },
    get textContent() { return this._text ?? ''; },

    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) { if (on) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },

    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },

    append(...kids) {
      for (const kid of kids) {
        kid.parentElement = this;
        this.children.push(kid);
      }
    },

    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type);
      if (list) listeners.set(type, list.filter((f) => f !== fn));
    },

    /** Fires handlers registered on THIS node only — the fake has no bubbling. */
    dispatch(type, event = {}) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(event);
    },
    listenerCount(type) { return (listeners.get(type) ?? []).length; },

    querySelector(selector) {
      const walk = (node) => {
        for (const kid of node.children) {
          if (matches(kid, selector)) return kid;
          const found = walk(kid);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },

    querySelectorAll(selector) {
      const out = [];
      const walk = (node) => {
        for (const kid of node.children) {
          if (matches(kid, selector)) out.push(kid);
          walk(kid);
        }
      };
      walk(this);
      return out;
    },
  };
}

/** An element with an id already set — the shape most panels look up. */
export function withId(id, tag = 'div') {
  const el = makeElement(tag);
  el.id = id;
  return el;
}

/**
 * Installs a fake `document` (and its `body`) on globalThis and returns the body.
 *
 * Safe to call per test file: `node --test` runs each file in its own process, so one
 * file's globals cannot leak into another's.
 */
export function installDocument(...ids) {
  const body = makeElement('body');
  for (const id of ids) body.append(withId(id, 'div'));

  globalThis.document = {
    body,
    createElement: (tag) => makeElement(tag),
    getElementById: (id) => (body.id === id ? body : body.querySelector(`#${id}`)),
  };

  return body;
}
