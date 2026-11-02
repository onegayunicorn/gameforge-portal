// engine/src/math/MathUtils.ts
var EPSILON = 1e-6;
var TAU = Math.PI * 2;
var DEG_TO_RAD = Math.PI / 180;
var RAD_TO_DEG = 180 / Math.PI;
function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function clamp01(value) {
  return clamp(value, 0, 1);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function degToRad(degrees) {
  return degrees * DEG_TO_RAD;
}

// engine/src/math/Vector2.ts
var Vector2 = class _Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  x;
  y;
  static ZERO = Object.freeze(new _Vector2(0, 0));
  static ONE = Object.freeze(new _Vector2(1, 1));
  static UP = Object.freeze(new _Vector2(0, -1));
  static DOWN = Object.freeze(new _Vector2(0, 1));
  static LEFT = Object.freeze(new _Vector2(-1, 0));
  static RIGHT = Object.freeze(new _Vector2(1, 0));
  static from(value, y) {
    if (typeof value === "number") return new _Vector2(value, y ?? value);
    if (Array.isArray(value)) return new _Vector2(value[0] ?? 0, value[1] ?? 0);
    return new _Vector2(value.x, value.y);
  }
  static add(a, b, out = new _Vector2()) {
    return out.set(a.x + b.x, a.y + b.y);
  }
  static sub(a, b, out = new _Vector2()) {
    return out.set(a.x - b.x, a.y - b.y);
  }
  static scale(a, scalar, out = new _Vector2()) {
    return out.set(a.x * scalar, a.y * scalar);
  }
  static dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }
  /** 2D cross product: the z component of the 3D cross of (a, 0) and (b, 0). */
  static cross(a, b) {
    return a.x * b.y - a.y * b.x;
  }
  static distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  static distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
  static lerp(a, b, t, out = new _Vector2()) {
    return out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy(other) {
    this.x = other.x;
    this.y = other.y;
    return this;
  }
  clone() {
    return new _Vector2(this.x, this.y);
  }
  add(other) {
    this.x += other.x;
    this.y += other.y;
    return this;
  }
  addScaled(other, scalar) {
    this.x += other.x * scalar;
    this.y += other.y * scalar;
    return this;
  }
  sub(other) {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }
  scale(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }
  multiply(other) {
    this.x *= other.x;
    this.y *= other.y;
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }
  /** Clamp each component into [min, max]. */
  clamp(min, max) {
    this.x = clamp(this.x, min, max);
    this.y = clamp(this.y, min, max);
    return this;
  }
  /** Clamp to unit length while preserving direction; zero stays zero. */
  limit(maxLength) {
    const lengthSq = this.lengthSquared;
    if (lengthSq > maxLength * maxLength && lengthSq > 0) {
      this.scale(maxLength / Math.sqrt(lengthSq));
    }
    return this;
  }
  normalize() {
    const length = this.length;
    if (length > EPSILON) this.scale(1 / length);
    return this;
  }
  /** Move this point towards `target` by at most `maxDistance`. */
  moveTowards(target, maxDistance) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= maxDistance || distance < EPSILON) return this.copy(target);
    return this.set(this.x + dx / distance * maxDistance, this.y + dy / distance * maxDistance);
  }
  rotate(radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const x = this.x * cos - this.y * sin;
    const y = this.x * sin + this.y * cos;
    return this.set(x, y);
  }
  /** Rotate around an arbitrary pivot rather than the origin. */
  rotateAround(pivot, radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = this.x - pivot.x;
    const dy = this.y - pivot.y;
    return this.set(pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos);
  }
  get lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }
  get length() {
    return Math.hypot(this.x, this.y);
  }
  /** Rotation of this vector in radians (atan2, so -PI..PI). */
  get angle() {
    return Math.atan2(this.y, this.x);
  }
  distanceTo(other) {
    return _Vector2.distance(this, other);
  }
  distanceToSquared(other) {
    return _Vector2.distanceSquared(this, other);
  }
  dot(other) {
    return _Vector2.dot(this, other);
  }
  cross(other) {
    return _Vector2.cross(this, other);
  }
  equals(other, tolerance = 0) {
    if (tolerance === 0) return this.x === other.x && this.y === other.y;
    return Math.abs(this.x - other.x) <= tolerance && Math.abs(this.y - other.y) <= tolerance;
  }
  /** True when both components are finite numbers. */
  get isFinite() {
    return Number.isFinite(this.x) && Number.isFinite(this.y);
  }
  toArray() {
    return [this.x, this.y];
  }
  toJSON() {
    return { x: this.x, y: this.y };
  }
  toString() {
    return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
};

// engine/src/scene/Transform.ts
var Transform = class _Transform {
  static componentName = "Transform";
  position = new Vector2(0, 0);
  scale = new Vector2(1, 1);
  /** Rotation in radians. */
  rotation = 0;
  /** Optional parent entity, resolved by TransformSystem when it is set. */
  parent = null;
  /** Direct children, maintained by TransformSystem. */
  children = [];
  /** Render ordering within a layer: higher draws on top. */
  zIndex = 0;
  // ---- derived (written by TransformSystem) ----
  worldPosition = new Vector2(0, 0);
  worldScale = new Vector2(1, 1);
  worldRotation = 0;
  dirty = true;
  constructor(position, rotation, scale) {
    if (position) this.position.copy(Vector2.from(position));
    if (rotation !== void 0) this.rotation = rotation;
    if (scale) this.scale.copy(scale);
  }
  get isDirty() {
    return this.dirty;
  }
  /** Flag local values as changed so the derived transform is recomputed. */
  markDirty() {
    this.dirty = true;
    return this;
  }
  /** Called by TransformSystem once the world transform has been recomputed. */
  clearDirty() {
    this.dirty = false;
  }
  setPosition(x, y) {
    this.position.set(x, y);
    return this.markDirty();
  }
  setRotation(radians) {
    this.rotation = radians;
    return this.markDirty();
  }
  /** Rotation helper for designers: degrees in, radians stored. */
  setRotationDegrees(degrees) {
    return this.setRotation(degToRad(degrees));
  }
  setScale(x, y = x) {
    this.scale.set(x, y);
    return this.markDirty();
  }
  translate(x, y) {
    this.position.x += x;
    this.position.y += y;
    return this.markDirty();
  }
  rotate(radians) {
    this.rotation += radians;
    return this.markDirty();
  }
  /** World-space rotation of a local direction. */
  rotatePoint(point, out = new Vector2()) {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return out.set(point.x * cos - point.y * sin, point.x * sin + point.y * cos);
  }
  toJSON() {
    return {
      position: this.position.toArray(),
      rotation: this.rotation,
      scale: this.scale.toArray(),
      zIndex: this.zIndex
    };
  }
  static fromJSON(data) {
    const transform = new _Transform();
    if (data.position) transform.position.copy(Vector2.from(data.position));
    if (data.rotation !== void 0) transform.rotation = data.rotation;
    if (data.scale) transform.scale.copy(Vector2.from(data.scale));
    if (data.zIndex !== void 0) transform.zIndex = data.zIndex;
    return transform;
  }
};

// engine/src/math/Color.ts
var Color = class _Color {
  constructor(r = 1, g = 1, b = 1, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  r;
  g;
  b;
  a;
  static TRANSPARENT = Object.freeze(new _Color(0, 0, 0, 0));
  static BLACK = Object.freeze(new _Color(0, 0, 0, 1));
  static WHITE = Object.freeze(new _Color(1, 1, 1, 1));
  static RED = Object.freeze(new _Color(1, 0, 0, 1));
  static GREEN = Object.freeze(new _Color(0, 1, 0, 1));
  static BLUE = Object.freeze(new _Color(0, 0, 1, 1));
  static YELLOW = Object.freeze(new _Color(1, 1, 0, 1));
  /** Parse `#rgb`, `#rrggbb`, `#rrggbbaa` or a `rgb()/rgba()` string. */
  static fromHex(hex) {
    const text = hex.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(text) || /^[0-9a-f]{4}$/i.test(text)) {
      const [r, g, b, a] = text.split("");
      return new _Color(
        parseInt(r + r, 16) / 255,
        parseInt(g + g, 16) / 255,
        parseInt(b + b, 16) / 255,
        a ? parseInt(a + a, 16) / 255 : 1
      );
    }
    if (/^[0-9a-f]{6}$/i.test(text) || /^[0-9a-f]{8}$/i.test(text)) {
      return new _Color(
        parseInt(text.slice(0, 2), 16) / 255,
        parseInt(text.slice(2, 4), 16) / 255,
        parseInt(text.slice(4, 6), 16) / 255,
        text.length === 8 ? parseInt(text.slice(6, 8), 16) / 255 : 1
      );
    }
    const match = /^rgba?\(([^)]+)\)$/i.exec(hex.trim());
    if (match) {
      const parts = match[1].split(",").map((p) => Number.parseFloat(p.trim()));
      const [r = 0, g = 0, b = 0, a = 1] = parts;
      return new _Color(
        clamp01(r > 1 ? r / 255 : r),
        clamp01(g > 1 ? g / 255 : g),
        clamp01(b > 1 ? b / 255 : b),
        clamp01(a)
      );
    }
    throw new Error(`Color.fromHex: unsupported colour string "${hex}"`);
  }
  /** Parse a float RGBA tuple as written in scene files: `[1, 0.5, 0, 1]`. */
  static fromArray(values) {
    return new _Color(values[0] ?? 1, values[1] ?? 1, values[2] ?? 1, values[3] ?? 1);
  }
  static lerp(a, b, t) {
    return new _Color(
      a.r + (b.r - a.r) * t,
      a.g + (b.g - a.g) * t,
      a.b + (b.b - a.b) * t,
      a.a + (b.a - a.a) * t
    );
  }
  set(r, g, b, a = this.a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    return this;
  }
  copy(other) {
    return this.set(other.r, other.g, other.b, other.a);
  }
  clone() {
    return new _Color(this.r, this.g, this.b, this.a);
  }
  /** Multiply channels in place - used for tinting. */
  multiply(other) {
    this.r *= other.r;
    this.g *= other.g;
    this.b *= other.b;
    this.a *= other.a;
    return this;
  }
  withAlpha(alpha) {
    this.a = clamp01(alpha);
    return this;
  }
  equals(other) {
    return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
  }
  toArray() {
    return [this.r, this.g, this.b, this.a];
  }
  toHex(includeAlpha = false) {
    const channel = (value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0");
    const base = `#${channel(this.r)}${channel(this.g)}${channel(this.b)}`;
    return includeAlpha ? `${base}${channel(this.a)}` : base;
  }
  /** Canvas/WebGL-ready string. */
  toCss() {
    const c = (v) => Math.round(clamp01(v) * 255);
    return `rgba(${c(this.r)}, ${c(this.g)}, ${c(this.b)}, ${clamp01(this.a)})`;
  }
  toJSON() {
    return this.toArray();
  }
  toString() {
    return `Color(${this.toHex(true)})`;
  }
};

// engine/src/math/Rectangle.ts
var Rectangle = class _Rectangle {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  x;
  y;
  width;
  height;
  static fromPoints(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return new _Rectangle(x, y, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  set(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }
  copy(other) {
    return this.set(other.x, other.y, other.width, other.height);
  }
  clone() {
    return new _Rectangle(this.x, this.y, this.width, this.height);
  }
  get left() {
    return this.x;
  }
  get top() {
    return this.y;
  }
  get right() {
    return this.x + this.width;
  }
  get bottom() {
    return this.y + this.height;
  }
  get centerX() {
    return this.x + this.width / 2;
  }
  get centerY() {
    return this.y + this.height / 2;
  }
  get area() {
    return this.width * this.height;
  }
  get isEmpty() {
    return this.width <= 0 || this.height <= 0;
  }
  get center() {
    return new Vector2(this.centerX, this.centerY);
  }
  get position() {
    return new Vector2(this.x, this.y);
  }
  get size() {
    return new Vector2(this.width, this.height);
  }
  containsPoint(point) {
    return point.x >= this.x && point.x < this.right && point.y >= this.y && point.y < this.bottom;
  }
  containsRect(other) {
    return other.x >= this.x && other.right <= this.right && other.y >= this.y && other.bottom <= this.bottom;
  }
  intersects(other) {
    return !(other.x >= this.right || other.right <= this.x || other.y >= this.bottom || other.bottom <= this.y);
  }
  /** Overlap area, or null when the rectangles do not intersect. */
  intersection(other) {
    if (!this.intersects(other)) return null;
    const x = Math.max(this.x, other.x);
    const y = Math.max(this.y, other.y);
    return new _Rectangle(
      x,
      y,
      Math.min(this.right, other.right) - x,
      Math.min(this.bottom, other.bottom) - y
    );
  }
  union(other) {
    const x = Math.min(this.x, other.x);
    const y = Math.min(this.y, other.y);
    return new _Rectangle(
      x,
      y,
      Math.max(this.right, other.right) - x,
      Math.max(this.bottom, other.bottom) - y
    );
  }
  inflate(amountX, amountY = amountX) {
    this.x -= amountX;
    this.y -= amountY;
    this.width += amountX * 2;
    this.height += amountY * 2;
    return this;
  }
  /** Shift so the rectangle is inside `bounds`, keeping its size when it fits. */
  clampTo(bounds) {
    const maxX = bounds.width <= this.width ? bounds.x : bounds.right - this.width;
    const maxY = bounds.height <= this.height ? bounds.y : bounds.bottom - this.height;
    this.x = clamp(this.x, bounds.x, Math.max(bounds.x, maxX));
    this.y = clamp(this.y, bounds.y, Math.max(bounds.y, maxY));
    return this;
  }
  equals(other, tolerance = 0) {
    return Math.abs(this.x - other.x) <= tolerance && Math.abs(this.y - other.y) <= tolerance && Math.abs(this.width - other.width) <= tolerance && Math.abs(this.height - other.height) <= tolerance;
  }
  toJSON() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
  toString() {
    return `Rectangle(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
  }
};

// engine/src/renderer/Material.ts
var Material = class _Material {
  color;
  texture;
  uv;
  blend;
  opacity;
  constructor(options = {}) {
    const { color } = options;
    this.color = typeof color === "string" ? Color.fromHex(color) : Array.isArray(color) ? Color.fromArray(color) : color ? color.clone() : Color.WHITE.clone();
    this.texture = options.texture ?? null;
    this.uv = options.uv ?? null;
    this.blend = options.blend ?? "normal";
    this.opacity = options.opacity ?? 1;
  }
  get isTextured() {
    return this.texture !== null && !this.texture.isDisposed;
  }
  /** Region of the texture to sample, defaulting to the whole texture. */
  get uvRect() {
    if (!this.texture) return null;
    return this.uv ?? new Rectangle(0, 0, this.texture.width, this.texture.height);
  }
  setColor(color) {
    if (typeof color === "string") this.color.copy(Color.fromHex(color));
    else if (Array.isArray(color)) this.color.copy(Color.fromArray(color));
    else this.color.copy(color);
    return this;
  }
  clone() {
    return new _Material({
      color: this.color,
      texture: this.texture,
      uv: this.uv ? this.uv.clone() : null,
      blend: this.blend,
      opacity: this.opacity
    });
  }
  static solid(color) {
    return new _Material({ color });
  }
};

// engine/src/renderer/Sprite.ts
var Sprite = class {
  static componentName = "Sprite";
  material;
  width;
  height;
  layer;
  visible;
  originX;
  originY;
  flipX;
  flipY;
  constructor(options = {}) {
    const texture = options.texture ?? null;
    this.material = new Material({
      color: options.color ?? Color.WHITE,
      texture,
      opacity: options.opacity ?? 1
    });
    this.width = options.width ?? texture?.width ?? 32;
    this.height = options.height ?? texture?.height ?? 32;
    this.layer = options.layer ?? 0;
    this.visible = options.visible ?? true;
    this.originX = options.originX ?? 0.5;
    this.originY = options.originY ?? 0.5;
    this.flipX = options.flipX ?? false;
    this.flipY = options.flipY ?? false;
  }
  get texture() {
    return this.material.texture;
  }
  set texture(value) {
    this.material.texture = value;
  }
  get color() {
    return this.material.color;
  }
  get opacity() {
    return this.material.opacity;
  }
  set opacity(value) {
    this.material.opacity = value;
  }
  /** Assign a texture and adopt its pixel size in one step. */
  setTexture(texture, adoptSize = false) {
    this.material.texture = texture;
    if (texture && adoptSize) {
      this.width = texture.width;
      this.height = texture.height;
    }
    return this;
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    return this;
  }
  /** Axis-aligned bounds in world space, accounting for rotation via the expanded extents. */
  bounds(transform, out = new Rectangle()) {
    const cos = Math.abs(Math.cos(transform.worldRotation));
    const sin = Math.abs(Math.sin(transform.worldRotation));
    const scaledWidth = this.width * Math.abs(transform.worldScale.x);
    const scaledHeight = this.height * Math.abs(transform.worldScale.y);
    const extentX = (scaledWidth * cos + scaledHeight * sin) / 2;
    const extentY = (scaledWidth * sin + scaledHeight * cos) / 2;
    return out.set(
      transform.worldPosition.x - extentX,
      transform.worldPosition.y - extentY,
      extentX * 2,
      extentY * 2
    );
  }
  /** Pivot offset in local pixels, used by the renderer to honour `origin`. */
  get originOffset() {
    return new Vector2(this.width * this.originX, this.height * this.originY);
  }
};

// engine/src/core/Scene.ts
var Scene = class {
  name;
  systems = [];
  /** Free-form scene data - spawn points, music track, level index, and so on. */
  metadata = {};
  /** The scene file this scene was loaded from, when it came from disk. */
  sourcePath = null;
  entityIds = /* @__PURE__ */ new Set();
  world = null;
  constructor(name, metadata) {
    if (!name) throw new Error("Scene requires a non-empty name");
    this.name = name;
    if (metadata) Object.assign(this.metadata, metadata);
  }
  get isAttached() {
    return this.world !== null;
  }
  get worldRef() {
    return this.world;
  }
  get entityCount() {
    return this.entityIds.size;
  }
  get entities() {
    return this.entityIds.values();
  }
  hasEntity(id) {
    return this.entityIds.has(id);
  }
  /** Register an entity with this scene. Called by World; not part of the game-facing API. */
  addEntity(id) {
    this.entityIds.add(id);
  }
  removeEntity(id) {
    return this.entityIds.delete(id);
  }
  clearEntities() {
    this.entityIds.clear();
  }
  addSystem(system) {
    this.systems.push(system);
    if (this.world) system.initialize?.(this.world);
    this.world?.invalidateSystemOrder();
    return this;
  }
  removeSystem(system) {
    const index = this.systems.indexOf(system);
    if (index === -1) return false;
    this.systems.splice(index, 1);
    system.dispose?.();
    this.world?.invalidateSystemOrder();
    return true;
  }
  /** Called by World when this scene becomes (or stops being) the active scene. */
  attach(world) {
    if (this.world && this.world !== world) {
      throw new Error(`Scene "${this.name}" is already attached to a different world`);
    }
    this.world = world;
    for (const system of this.systems) system.initialize?.(world);
  }
  detach() {
    this.world = null;
  }
  dispose() {
    for (const system of this.systems) system.dispose?.();
    this.systems.length = 0;
    this.entityIds.clear();
    this.world = null;
  }
  toJSON() {
    return {
      name: this.name,
      metadata: { ...this.metadata },
      entityCount: this.entityIds.size,
      systems: this.systems.map((system) => system.name ?? "anonymous")
    };
  }
  toString() {
    return `Scene(${this.name}, entities=${this.entityIds.size})`;
  }
};

// engine/src/renderer/primitives/Quad.ts
function quad(options) {
  const color = typeof options.color === "string" ? Color.fromHex(options.color) : Array.isArray(options.color) ? Color.fromArray(options.color) : options.color?.clone() ?? Color.WHITE.clone();
  return {
    kind: "quad",
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    originX: options.width / 2,
    originY: options.height / 2,
    rotation: options.rotation ?? 0,
    material: new Material({ color, texture: options.texture ?? null }),
    alpha: options.alpha ?? 1,
    layer: options.layer ?? 0,
    blend: options.blend ?? "normal",
    flipX: false,
    flipY: false
  };
}
function rect(x, y, width, height, color, layer = 0) {
  const command = quad({ x: x + width / 2, y: y + height / 2, width, height, color, layer });
  return command;
}

// engine/src/ecs/EntityManager.ts
var EntityManager = class {
  nextId = 1;
  alive = /* @__PURE__ */ new Set();
  destroyListeners = /* @__PURE__ */ new Set();
  create() {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }
  createMany(count) {
    const ids = new Array(count);
    for (let i = 0; i < count; i += 1) ids[i] = this.create();
    return ids;
  }
  /** Destroy an entity. Returns false when it was already gone. */
  destroy(id) {
    if (!this.alive.delete(id)) return false;
    for (const listener of Array.from(this.destroyListeners)) listener(id);
    return true;
  }
  destroyAll() {
    for (const id of Array.from(this.alive)) this.destroy(id);
  }
  isAlive(id) {
    return this.alive.has(id);
  }
  ids() {
    return this.alive.values();
  }
  get count() {
    return this.alive.size;
  }
  /** Subscribe to destruction so component storage can detach cleanly. */
  onDestroy(listener) {
    this.destroyListeners.add(listener);
    return () => this.destroyListeners.delete(listener);
  }
  /** Return to a pristine state. Intended for tests and full scene reloads. */
  reset() {
    this.alive.clear();
    this.nextId = 1;
  }
};

// engine/src/core/Component.ts
function componentHooks(component) {
  return component;
}
function componentTypeName(type) {
  const named = type.componentName;
  return named ?? type.name ?? "AnonymousComponent";
}

// engine/src/ecs/ComponentStore.ts
var ComponentStore = class {
  stores = /* @__PURE__ */ new Map();
  storeFor(type, create) {
    let store = this.stores.get(type);
    if (!store && create) {
      store = /* @__PURE__ */ new Map();
      this.stores.set(type, store);
    }
    return store;
  }
  /**
   * Attach a component to an entity. Adding a second instance of the same type replaces the first
   * after calling its `onDetach` hook, which keeps "one component of a type per entity" true.
   */
  add(entity, component) {
    const type = component.constructor;
    const store = this.storeFor(type, true);
    const previous = store.get(entity);
    if (previous && previous !== component) componentHooks(previous).onDetach?.();
    store.set(entity, component);
    componentHooks(component).onAttach?.();
    return component;
  }
  get(entity, type) {
    return this.storeFor(type, false)?.get(entity);
  }
  has(entity, type) {
    return this.storeFor(type, false)?.has(entity) ?? false;
  }
  remove(entity, type) {
    const store = this.storeFor(type, false);
    const component = store?.get(entity);
    if (!store || !component) return false;
    componentHooks(component).onDetach?.();
    store.delete(entity);
    if (store.size === 0) this.stores.delete(type);
    return true;
  }
  /** Remove every component belonging to an entity; called when the entity is destroyed. */
  removeAll(entity) {
    let removed = 0;
    for (const [type, store] of this.stores) {
      const component = store.get(entity);
      if (!component) continue;
      componentHooks(component).onDetach?.();
      store.delete(entity);
      if (store.size === 0) this.stores.delete(type);
      removed += 1;
    }
    return removed;
  }
  /** All components of a type, keyed by entity. Used by queries and serialisation. */
  entries(type) {
    const store = this.storeFor(type, false);
    return store ? store.entries() : (/* @__PURE__ */ new Map()).entries();
  }
  /** Raw storage for a type, or undefined when no entity has one. */
  storageFor(type) {
    return this.storeFor(type, false);
  }
  count(type) {
    return this.storeFor(type, false)?.size ?? 0;
  }
  /** Component types that currently have at least one instance. */
  registeredTypes() {
    return Array.from(this.stores.keys());
  }
  clear() {
    for (const store of this.stores.values()) {
      for (const component of store.values()) componentHooks(component).onDetach?.();
    }
    this.stores.clear();
  }
};

// engine/src/ecs/Query.ts
var Query = class {
  constructor(store, types) {
    this.store = store;
    this.types = types.slice();
    let smallest = null;
    let smallestSize = Number.POSITIVE_INFINITY;
    for (const type of this.types) {
      const size = store.count(type);
      if (size < smallestSize) {
        smallestSize = size;
        smallest = type;
      }
    }
    this.driver = smallestSize === 0 ? null : smallest;
  }
  store;
  types;
  driver;
  get componentTypes() {
    return this.types;
  }
  /** Number of entities currently matching. */
  get count() {
    if (!this.driver) return 0;
    let total = 0;
    for (const _ of this) total += 1;
    return total;
  }
  /** True when the entity carries every queried component type. */
  matches(entity) {
    for (const type of this.types) {
      if (!this.store.has(entity, type)) return false;
    }
    return true;
  }
  *[Symbol.iterator]() {
    if (!this.driver) return;
    const storage = this.store.storageFor(this.driver);
    if (!storage) return;
    for (const entity of storage.keys()) {
      const components = new Array(this.types.length);
      let complete = true;
      for (let i = 0; i < this.types.length; i += 1) {
        const component = this.store.get(entity, this.types[i]);
        if (!component) {
          complete = false;
          break;
        }
        components[i] = component;
      }
      if (complete) yield { entity, components };
    }
  }
  /** Collect matches into an array without allocating a generator per call site. */
  toArray() {
    return Array.from(this);
  }
  forEach(callback) {
    for (const match of this) callback(match);
  }
  first() {
    for (const match of this) return match;
    return null;
  }
};

// engine/src/core/EventBus.ts
var EventBus = class {
  channels = /* @__PURE__ */ new Map();
  onError;
  constructor(onError) {
    this.onError = onError ?? ((error, type) => {
      console.error(`EventBus handler for "${String(type)}" threw`, error);
    });
  }
  on(type, handler) {
    return this.add(type, handler, false);
  }
  once(type, handler) {
    return this.add(type, handler, true);
  }
  add(type, handler, once) {
    let set = this.channels.get(type);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.channels.set(type, set);
    }
    const subscription = { handler, once };
    set.add(subscription);
    return () => set.delete(subscription);
  }
  off(type, handler) {
    const set = this.channels.get(type);
    if (!set) return;
    for (const subscription of set) {
      if (subscription.handler === handler) set.delete(subscription);
    }
  }
  emit(type, payload) {
    const set = this.channels.get(type);
    if (!set || set.size === 0) return;
    for (const subscription of Array.from(set)) {
      if (subscription.once) set.delete(subscription);
      try {
        subscription.handler(payload);
      } catch (error) {
        this.onError(error, type);
      }
    }
  }
  listenerCount(type) {
    return this.channels.get(type)?.size ?? 0;
  }
  /** Detach every handler; called when a world or engine is disposed. */
  clear(type) {
    if (type === void 0) this.channels.clear();
    else this.channels.delete(type);
  }
};

// engine/src/core/Entity.ts
var Entity = class {
  constructor(world, id) {
    this.world = world;
    this.id = id;
  }
  world;
  id;
  get isAlive() {
    return this.world.isAlive(this.id);
  }
  add(component) {
    this.world.addComponent(this.id, component);
    return this;
  }
  get(type) {
    return this.world.getComponent(this.id, type);
  }
  has(type) {
    return this.world.hasComponent(this.id, type);
  }
  /** Get the component or throw - for required components in system code. */
  require(type) {
    const found = this.get(type);
    if (!found) {
      throw new Error(`Entity ${this.id} is missing required component ${type.name}`);
    }
    return found;
  }
  remove(type) {
    this.world.removeComponent(this.id, type);
    return this;
  }
  destroy() {
    this.world.destroyEntity(this.id);
  }
  toString() {
    return `Entity(${this.id})`;
  }
};

// engine/src/core/System.ts
var SystemPriority = {
  Input: -500,
  Transform: -300,
  Script: -100,
  Physics: 0,
  Animation: 100,
  Render: 500,
  Ui: 600,
  DebugDraw: 900
};
function compareSystems(a, b) {
  return (a.priority ?? 0) - (b.priority ?? 0);
}

// engine/src/renderer/RenderQueue.ts
var RenderQueue = class {
  items = [];
  sequence = 0;
  sorted = true;
  add(command) {
    this.items.push({ command, sequence: this.sequence++ });
    this.sorted = false;
  }
  get size() {
    return this.items.length;
  }
  /** Distinct layers present in the queue, used for renderer diagnostics. */
  get layerCount() {
    const layers = /* @__PURE__ */ new Set();
    for (const item of this.items) layers.add(item.command.layer);
    return layers.size;
  }
  get isEmpty() {
    return this.items.length === 0;
  }
  /** Stable sort by layer, then by insertion order. */
  sort() {
    if (this.sorted) return;
    this.items.sort((a, b) => {
      const layerDelta = a.command.layer - b.command.layer;
      return layerDelta !== 0 ? layerDelta : a.sequence - b.sequence;
    });
    this.sorted = true;
  }
  /** Submit everything to a renderer, then empty the queue. */
  flush(renderer) {
    this.sort();
    for (const item of this.items) renderer.draw(item.command);
    const drawn = this.items.length;
    this.clear();
    return drawn;
  }
  clear() {
    this.items.length = 0;
    this.sequence = 0;
    this.sorted = true;
  }
};

// engine/src/core/World.ts
var World = class {
  entities = new EntityManager();
  components = new ComponentStore();
  events;
  renderQueue = new RenderQueue();
  services = {};
  systems = [];
  systemsCache = null;
  scenes = /* @__PURE__ */ new Map();
  activeSceneValue = null;
  destroyEntitiesOnSceneSwitch;
  onError;
  disposed = false;
  constructor(options = {}) {
    this.events = options.events ?? new EventBus();
    this.destroyEntitiesOnSceneSwitch = options.destroyEntitiesOnSceneSwitch ?? true;
    this.onError = options.onError ?? ((error, context) => {
      console.error(`[gameforge] error in ${context}`, error);
    });
    this.entities.onDestroy((id) => {
      this.components.removeAll(id);
      for (const scene of this.scenes.values()) scene.removeEntity(id);
      this.events.emit("entity:destroyed", { id });
    });
  }
  /* ------------------------------------------------------------------ entities */
  createEntity() {
    const id = this.entities.create();
    this.activeSceneValue?.addEntity(id);
    this.events.emit("entity:created", { id });
    return id;
  }
  /** Convenience: create an entity and attach components in one call. */
  spawn(...components) {
    const id = this.createEntity();
    for (const component of components) this.components.add(id, component);
    return new Entity(this, id);
  }
  entity(id) {
    return new Entity(this, id);
  }
  destroyEntity(id) {
    return this.entities.destroy(id);
  }
  isAlive(id) {
    return this.entities.isAlive(id);
  }
  get entityCount() {
    return this.entities.count;
  }
  addComponent(id, component) {
    if (!this.entities.isAlive(id)) {
      throw new Error(`Cannot add ${component.constructor.name} to dead entity ${id}`);
    }
    return this.components.add(id, component);
  }
  getComponent(id, type) {
    return this.components.get(id, type);
  }
  hasComponent(id, type) {
    return this.components.has(id, type);
  }
  removeComponent(id, type) {
    return this.components.remove(id, type);
  }
  /** Build a query over the given component types; reusing a query is cheaper than rebuilding it. */
  query(...types) {
    return new Query(this.components, types);
  }
  /* ------------------------------------------------------------------ systems */
  addSystem(system) {
    if (this.systems.includes(system)) return this;
    this.systems.push(system);
    system.initialize?.(this);
    this.invalidateSystemOrder();
    return this;
  }
  removeSystem(system) {
    const index = this.systems.indexOf(system);
    if (index === -1) return false;
    this.systems.splice(index, 1);
    system.dispose?.();
    this.invalidateSystemOrder();
    return true;
  }
  get systemList() {
    return this.systems;
  }
  /** Force the merged system list to be rebuilt on the next update (scene switch, add/remove). */
  invalidateSystemOrder() {
    this.systemsCache = null;
  }
  orderedSystems() {
    if (this.systemsCache) return this.systemsCache;
    const sceneSystems = this.activeSceneValue?.systems ?? [];
    const merged = sceneSystems.length === 0 ? this.systems.slice() : [...this.systems, ...sceneSystems];
    merged.sort(compareSystems);
    this.systemsCache = merged;
    return merged;
  }
  /* ------------------------------------------------------------------ scenes */
  addScene(scene) {
    if (this.scenes.has(scene.name) && this.scenes.get(scene.name) !== scene) {
      throw new Error(`A scene named "${scene.name}" already exists in this world`);
    }
    this.scenes.set(scene.name, scene);
    return scene;
  }
  getScene(name) {
    return this.scenes.get(name);
  }
  get sceneNames() {
    return Array.from(this.scenes.keys());
  }
  /**
   * Activate a scene by reference or name. The outgoing scene's entities are destroyed by default,
   * so a level transition cannot leak entities from the previous level into the next one.
   */
  setActiveScene(scene) {
    const next = typeof scene === "string" ? this.scenes.get(scene) ?? null : scene;
    if (typeof scene === "string" && !next) {
      throw new Error(`Cannot activate unknown scene "${scene}"`);
    }
    if (next === this.activeSceneValue) return this.activeSceneValue;
    const previousName = this.activeSceneValue?.name ?? null;
    if (this.activeSceneValue) {
      if (this.destroyEntitiesOnSceneSwitch) {
        for (const id of Array.from(this.activeSceneValue.entities)) this.entities.destroy(id);
      }
      this.activeSceneValue.detach();
    }
    this.activeSceneValue = next;
    if (next) {
      if (!this.scenes.has(next.name)) this.scenes.set(next.name, next);
      next.attach(this);
      this.events.emit("scene:changed", { from: previousName, to: next.name });
    }
    this.invalidateSystemOrder();
    return this.activeSceneValue;
  }
  get activeScene() {
    return this.activeSceneValue;
  }
  /* ------------------------------------------------------------------ stepping */
  /** Fixed-rate simulation step: runs every system in priority order. */
  update(deltaSeconds) {
    if (this.disposed) return;
    for (const system of this.orderedSystems()) {
      if (!system.update) continue;
      try {
        system.update(this, deltaSeconds);
      } catch (error) {
        this.onError(error, `system ${system.name ?? "anonymous"} update`);
      }
    }
  }
  /** Variable-rate presentation step. Systems that draw implement `render`. */
  render(alpha) {
    if (this.disposed) return;
    for (const system of this.orderedSystems()) {
      if (!system.render) continue;
      try {
        system.render(this, alpha);
      } catch (error) {
        this.onError(error, `system ${system.name ?? "anonymous"} render`);
      }
    }
  }
  /* ------------------------------------------------------------------ lifecycle */
  /** Destroy every entity and clear the render queue, keeping systems and scenes registered. */
  clear() {
    this.entities.destroyAll();
    this.renderQueue.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    for (const system of this.systems.slice()) this.removeSystem(system);
    for (const scene of this.scenes.values()) scene.dispose();
    this.scenes.clear();
    this.activeSceneValue = null;
    this.events.clear();
  }
  get isDisposed() {
    return this.disposed;
  }
};

// engine/src/core/Clock.ts
var Clock = class {
  lastTimestamp = 0;
  running = false;
  paused = false;
  elapsedSeconds = 0;
  frameCountValue = 0;
  timeScaleValue = 1;
  currentDelta = 0;
  now;
  constructor(now3) {
    this.now = now3 ?? (() => typeof performance !== "undefined" ? performance.now() : Date.now());
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTimestamp = this.now();
    this.currentDelta = 0;
  }
  stop() {
    this.running = false;
    this.paused = false;
    this.currentDelta = 0;
  }
  pause() {
    this.paused = true;
    this.currentDelta = 0;
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.lastTimestamp = this.now();
    this.currentDelta = 0;
  }
  reset() {
    this.lastTimestamp = this.now();
    this.elapsedSeconds = 0;
    this.frameCountValue = 0;
    this.currentDelta = 0;
  }
  /**
   * Advance to the current wall-clock time and return the delta in seconds.
   * Returns 0 while stopped or paused so callers can simply accumulate the result.
   */
  tick() {
    if (!this.running || this.paused) {
      this.currentDelta = 0;
      return 0;
    }
    const timestamp = this.now();
    const rawDeltaSeconds = (timestamp - this.lastTimestamp) / 1e3;
    this.lastTimestamp = timestamp;
    this.currentDelta = Math.max(0, rawDeltaSeconds) * this.timeScaleValue;
    this.elapsedSeconds += this.currentDelta;
    this.frameCountValue += 1;
    return this.currentDelta;
  }
  /**
   * Advance manually by an exact amount. Used by deterministic tests and headless simulation.
   * `deltaSeconds` is scaled like a real frame so timeScale is honoured.
   */
  step(deltaSeconds) {
    const scaled = Math.max(0, deltaSeconds) * this.timeScaleValue;
    this.currentDelta = scaled;
    this.elapsedSeconds += scaled;
    this.frameCountValue += 1;
    return scaled;
  }
  setTimeScale(scale) {
    this.timeScaleValue = Math.max(0, scale);
  }
  get timeScale() {
    return this.timeScaleValue;
  }
  get delta() {
    return this.currentDelta;
  }
  get elapsed() {
    return this.elapsedSeconds;
  }
  get frameCount() {
    return this.frameCountValue;
  }
  get isRunning() {
    return this.running && !this.paused;
  }
  get isPaused() {
    return this.paused;
  }
};

// engine/src/core/GameLoop.ts
var DEFAULT_SCHEDULE = (callback) => {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(() => callback());
  return setTimeout(callback, 16);
};
var DEFAULT_CANCEL = (handle) => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
  else clearTimeout(handle);
};
var GameLoop = class {
  clock;
  callbacks;
  schedule;
  cancel;
  accumulator = 0;
  handle = null;
  running = false;
  fpsValue = 0;
  frameTimeValue = 0;
  framesValue = 0;
  updateStepsValue = 0;
  droppedTimeValue = 0;
  fixedTimeStep;
  maxDeltaTime;
  maxSubSteps;
  constructor(options, callbacks) {
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.maxDeltaTime = options.maxDeltaTime ?? 0.25;
    this.maxSubSteps = Math.max(1, options.maxSubSteps ?? 5);
    this.schedule = options.schedule ?? DEFAULT_SCHEDULE;
    this.cancel = options.cancel ?? DEFAULT_CANCEL;
    this.clock = options.clock ?? new Clock();
    this.callbacks = callbacks;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.handle = this.schedule(this.onFrame);
  }
  stop() {
    this.running = false;
    this.clock.stop();
    if (this.handle !== null) {
      this.cancel(this.handle);
      this.handle = null;
    }
  }
  pause() {
    this.clock.pause();
  }
  resume() {
    this.clock.resume();
  }
  get isRunning() {
    return this.running;
  }
  get isPaused() {
    return this.clock.isPaused;
  }
  get interpolationAlpha() {
    return this.fixedTimeStep > 0 ? this.accumulator / this.fixedTimeStep : 0;
  }
  get stats() {
    return {
      fps: this.fpsValue,
      frameTimeMs: this.frameTimeValue,
      frames: this.framesValue,
      updateSteps: this.updateStepsValue,
      droppedTime: this.droppedTimeValue
    };
  }
  onFrame = () => {
    if (!this.running) return;
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.frame(this.clock.tick());
    const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
    this.frameTimeValue = this.frameTimeValue === 0 ? elapsed : this.frameTimeValue * 0.9 + elapsed * 0.1;
    const instantFps = elapsed > 0 ? 1e3 / elapsed : 0;
    this.fpsValue = this.fpsValue === 0 ? instantFps : this.fpsValue * 0.9 + instantFps * 0.1;
    this.handle = this.schedule(this.onFrame);
  };
  /**
   * Advance one variable-rate frame.
   *
   * Runs zero or more fixed simulation steps, then renders once. Excess time beyond
   * `maxSubSteps` is discarded (and reported in `stats.droppedTime`) rather than accumulated
   * forever, which is what prevents the classic spiral-of-death on a stalled tab.
   */
  frame(frameDelta) {
    if (this.clock.isPaused) {
      this.callbacks.render(0, 0);
      return;
    }
    const clamped = Math.min(Math.max(frameDelta, 0), this.maxDeltaTime);
    this.accumulator += clamped;
    let steps = 0;
    while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
      this.callbacks.update(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      steps += 1;
      this.updateStepsValue += 1;
    }
    if (this.accumulator >= this.fixedTimeStep) {
      this.droppedTimeValue += this.accumulator;
      this.accumulator = 0;
    }
    this.framesValue += 1;
    this.callbacks.render(this.interpolationAlpha, clamped);
  }
  /**
   * Run exactly `steps` fixed simulation steps. Deterministic and scheduler-free, so a test can
   * assert simulation state without involving wall-clock time.
   */
  advance(steps) {
    for (let i = 0; i < steps; i += 1) {
      this.clock.step(this.fixedTimeStep);
      this.callbacks.update(this.fixedTimeStep);
      this.updateStepsValue += 1;
    }
  }
  /** Reset accumulated frame state, keeping options intact. */
  reset() {
    this.accumulator = 0;
    this.fpsValue = 0;
    this.frameTimeValue = 0;
    this.framesValue = 0;
    this.updateStepsValue = 0;
    this.droppedTimeValue = 0;
    this.clock.reset();
  }
};

// engine/src/core/EngineConfig.ts
function resolveEngineConfig(config = {}) {
  const canvas = config.canvas ?? null;
  const width = config.width ?? canvas?.width ?? 1280;
  const height = config.height ?? canvas?.height ?? 720;
  if (!Number.isFinite(width) || width <= 0) throw new Error(`EngineConfig.width must be > 0, received ${width}`);
  if (!Number.isFinite(height) || height <= 0) throw new Error(`EngineConfig.height must be > 0, received ${height}`);
  const fixedTimeStep = config.fixedTimeStep ?? 1 / 60;
  if (!Number.isFinite(fixedTimeStep) || fixedTimeStep <= 0 || fixedTimeStep > 1) {
    throw new Error(`EngineConfig.fixedTimeStep must be within (0, 1], received ${fixedTimeStep}`);
  }
  const maxDeltaTime = config.maxDeltaTime ?? 0.25;
  if (!Number.isFinite(maxDeltaTime) || maxDeltaTime <= 0) {
    throw new Error(`EngineConfig.maxDeltaTime must be > 0, received ${maxDeltaTime}`);
  }
  const headless = config.headless ?? !canvas;
  if (!headless && !canvas) {
    throw new Error("EngineConfig.canvas is required unless headless mode is enabled");
  }
  const devicePixelRatio = typeof globalThis !== "undefined" ? globalThis.devicePixelRatio ?? 1 : 1;
  return {
    canvas,
    width,
    height,
    fixedTimeStep,
    maxDeltaTime,
    renderer: config.renderer ?? "auto",
    debug: config.debug ?? false,
    headless,
    pixelRatio: config.pixelRatio ?? devicePixelRatio,
    targetFps: config.targetFps ?? 0
  };
}

// engine/src/input/Keyboard.ts
var Keyboard = class _Keyboard {
  enabled = true;
  /** Keys whose default browser action is suppressed, e.g. Space scrolling the page. */
  preventDefaultFor = /* @__PURE__ */ new Set();
  down = /* @__PURE__ */ new Set();
  pressed = /* @__PURE__ */ new Set();
  released = /* @__PURE__ */ new Set();
  target = null;
  attach(target = globalThis) {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
    target.addEventListener("blur", this.handleBlur);
  }
  detach() {
    if (!this.target) return;
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("blur", this.handleBlur);
    this.target = null;
    this.reset();
  }
  static codeOf(event) {
    return event.code && event.code.length > 0 ? event.code : event.key;
  }
  handleKeyDown = (event) => {
    if (!this.enabled) return;
    const code = _Keyboard.codeOf(event);
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
    if (this.preventDefaultFor.has(code)) event.preventDefault();
  };
  handleKeyUp = (event) => {
    if (!this.enabled) return;
    const code = _Keyboard.codeOf(event);
    this.down.delete(code);
    this.released.add(code);
    if (this.preventDefaultFor.has(code)) event.preventDefault();
  };
  handleBlur = () => {
    this.reset();
  };
  isDown(code) {
    return this.down.has(code);
  }
  wasPressed(code) {
    return this.pressed.has(code);
  }
  wasReleased(code) {
    return this.released.has(code);
  }
  /** Every key currently held. */
  get heldKeys() {
    return Array.from(this.down);
  }
  get anyKeyDown() {
    return this.down.size > 0;
  }
  /** Clear per-frame edge state. Called by `Input.endFrame()`. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
  /** Drop all state, including held keys. */
  reset() {
    this.down.clear();
    this.pressed.clear();
    this.released.clear();
  }
};

// engine/src/input/Mouse.ts
var Mouse = class {
  enabled = true;
  position = new Vector2(0, 0);
  delta = new Vector2(0, 0);
  wheelDelta = 0;
  down = /* @__PURE__ */ new Set();
  pressed = /* @__PURE__ */ new Set();
  released = /* @__PURE__ */ new Set();
  target = null;
  element = null;
  captureOnDown = false;
  inside = false;
  attach(target = globalThis, options = {}) {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    this.element = options.element ?? target;
    this.captureOnDown = options.captureOnDown ?? false;
    target.addEventListener("mousemove", this.handleMove);
    target.addEventListener("mousedown", this.handleDown);
    target.addEventListener("mouseup", this.handleUp);
    target.addEventListener("wheel", this.handleWheel, { passive: false });
    target.addEventListener("mouseleave", this.handleLeave);
  }
  detach() {
    if (!this.target) return;
    this.target.removeEventListener("mousemove", this.handleMove);
    this.target.removeEventListener("mousedown", this.handleDown);
    this.target.removeEventListener("mouseup", this.handleUp);
    this.target.removeEventListener("wheel", this.handleWheel);
    this.target.removeEventListener("mouseleave", this.handleLeave);
    this.target = null;
    this.element = null;
    this.reset();
  }
  updatePosition(clientX, clientY) {
    const element = this.element;
    let x = clientX;
    let y = clientY;
    if (element && typeof element.getBoundingClientRect === "function") {
      const rect2 = element.getBoundingClientRect();
      x -= rect2.left;
      y -= rect2.top;
    }
    this.delta.set(x - this.position.x, y - this.position.y);
    this.position.set(x, y);
  }
  handleMove = (event) => {
    if (!this.enabled) return;
    this.inside = true;
    this.updatePosition(event.clientX, event.clientY);
  };
  handleDown = (event) => {
    if (!this.enabled) return;
    this.updatePosition(event.clientX, event.clientY);
    if (!this.down.has(event.button)) this.pressed.add(event.button);
    this.down.add(event.button);
    const pointerId = event.pointerId;
    if (this.captureOnDown && this.element?.setPointerCapture && typeof pointerId === "number") {
      try {
        this.element.setPointerCapture(pointerId);
      } catch {
      }
    }
  };
  handleUp = (event) => {
    if (!this.enabled) return;
    this.updatePosition(event.clientX, event.clientY);
    this.down.delete(event.button);
    this.released.add(event.button);
  };
  handleWheel = (event) => {
    if (!this.enabled) return;
    this.wheelDelta += event.deltaY;
    if (event.cancelable) event.preventDefault();
  };
  handleLeave = () => {
    this.inside = false;
  };
  /** Left button, the common case, so callers can avoid magic numbers. */
  get isPrimaryDown() {
    return this.down.has(0);
  }
  isButtonDown(button) {
    return this.down.has(button);
  }
  wasButtonPressed(button) {
    return this.pressed.has(button);
  }
  wasButtonReleased(button) {
    return this.released.has(button);
  }
  get isInside() {
    return this.inside;
  }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.delta.set(0, 0);
    this.wheelDelta = 0;
  }
  reset() {
    this.down.clear();
    this.endFrame();
  }
};

// engine/src/input/Touch.ts
var Touch = class {
  enabled = true;
  activeTouches = /* @__PURE__ */ new Map();
  started = /* @__PURE__ */ new Set();
  ended = /* @__PURE__ */ new Set();
  target = null;
  element = null;
  preventDefaultBehaviour = false;
  attach(target = globalThis, options = {}) {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    this.element = options.element ?? target;
    this.preventDefaultBehaviour = options.preventDefault ?? false;
    target.addEventListener("touchstart", this.handleStart, { passive: !this.preventDefaultBehaviour });
    target.addEventListener("touchmove", this.handleMove, { passive: !this.preventDefaultBehaviour });
    target.addEventListener("touchend", this.handleEnd);
    target.addEventListener("touchcancel", this.handleEnd);
  }
  detach() {
    if (!this.target) return;
    this.target.removeEventListener("touchstart", this.handleStart);
    this.target.removeEventListener("touchmove", this.handleMove);
    this.target.removeEventListener("touchend", this.handleEnd);
    this.target.removeEventListener("touchcancel", this.handleEnd);
    this.target = null;
    this.element = null;
    this.reset();
  }
  localPoint(clientX, clientY) {
    const element = this.element;
    if (!element || typeof element.getBoundingClientRect !== "function") return new Vector2(clientX, clientY);
    const rect2 = element.getBoundingClientRect();
    return new Vector2(clientX - rect2.left, clientY - rect2.top);
  }
  handleStart = (event) => {
    if (!this.enabled) return;
    if (this.preventDefaultBehaviour && event.cancelable) event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      const point = this.localPoint(touch.clientX, touch.clientY);
      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        position: point,
        startPosition: point.clone(),
        delta: new Vector2(0, 0)
      });
      this.started.add(touch.identifier);
    }
  };
  handleMove = (event) => {
    if (!this.enabled) return;
    if (this.preventDefaultBehaviour && event.cancelable) event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      const existing = this.activeTouches.get(touch.identifier);
      if (!existing) continue;
      const point = this.localPoint(touch.clientX, touch.clientY);
      existing.position.copy(point);
      existing.delta.set(point.x - existing.startPosition.x, point.y - existing.startPosition.y);
    }
  };
  handleEnd = (event) => {
    if (!this.enabled) return;
    for (const touch of Array.from(event.changedTouches)) {
      if (this.activeTouches.delete(touch.identifier)) this.ended.add(touch.identifier);
    }
  };
  get touchCount() {
    return this.activeTouches.size;
  }
  get isTouching() {
    return this.activeTouches.size > 0;
  }
  /** First active touch, or null. Most games only care about one finger. */
  get primary() {
    for (const point of this.activeTouches.values()) return point;
    return null;
  }
  getAll() {
    return Array.from(this.activeTouches.values());
  }
  wasStarted(id) {
    if (id === void 0) return this.started.size > 0;
    return this.started.has(id);
  }
  wasEnded(id) {
    if (id === void 0) return this.ended.size > 0;
    return this.ended.has(id);
  }
  /** True when a touch began this frame and has not moved far - a tap rather than a drag. */
  wasTapped(maxTravel = 12) {
    for (const id of this.started) {
      const point = this.activeTouches.get(id);
      if (point && point.position.distanceTo(point.startPosition) <= maxTravel) return true;
    }
    return false;
  }
  endFrame() {
    this.started.clear();
    this.ended.clear();
  }
  reset() {
    this.activeTouches.clear();
    this.endFrame();
  }
};

// engine/src/input/InputMap.ts
var InputMap = class {
  constructor(input) {
    this.input = input;
  }
  input;
  actions = /* @__PURE__ */ new Map();
  axes = /* @__PURE__ */ new Map();
  enabled = true;
  /** Suspend action queries without detaching the underlying devices. */
  setEnabled(enabled) {
    this.enabled = enabled;
    return this;
  }
  bindKey(action, code) {
    return this.addBinding(action, { source: "key", code });
  }
  bindMouse(action, button = 0) {
    return this.addBinding(action, { source: "mouse", code: button });
  }
  bindTouch(action) {
    return this.addBinding(action, { source: "touch", code: -1 });
  }
  addBinding(action, binding) {
    const existing = this.actions.get(action);
    if (existing) {
      if (!existing.some((b) => b.source === binding.source && b.code === binding.code)) existing.push(binding);
    } else {
      this.actions.set(action, [binding]);
    }
    return this;
  }
  /** Define an axis from two actions, e.g. `axis("moveX", "left", "right")`. */
  defineAxis(axis, negativeAction, positiveAction) {
    this.axes.set(axis, {
      negative: this.actions.get(negativeAction) ?? [],
      positive: this.actions.get(positiveAction) ?? []
    });
    return this;
  }
  clearBindings() {
    this.actions.clear();
    this.axes.clear();
  }
  get actionsBound() {
    return Array.from(this.actions.keys());
  }
  get axesBound() {
    return Array.from(this.axes.keys());
  }
  bindingIsDown(binding) {
    switch (binding.source) {
      case "key":
        return this.input.keyboard.isDown(binding.code);
      case "mouse":
        return this.input.mouse.isButtonDown(binding.code);
      case "touch":
        return this.input.touch.isTouching;
    }
  }
  bindingWasPressed(binding) {
    switch (binding.source) {
      case "key":
        return this.input.keyboard.wasPressed(binding.code);
      case "mouse":
        return this.input.mouse.wasButtonPressed(binding.code);
      case "touch":
        return this.input.touch.wasStarted();
    }
  }
  bindingWasReleased(binding) {
    switch (binding.source) {
      case "key":
        return this.input.keyboard.wasReleased(binding.code);
      case "mouse":
        return this.input.mouse.wasButtonReleased(binding.code);
      case "touch":
        return this.input.touch.wasEnded();
    }
  }
  isDown(action) {
    if (!this.enabled) return false;
    const bindings = this.actions.get(action);
    if (!bindings) return false;
    return bindings.some((binding) => this.bindingIsDown(binding));
  }
  wasPressed(action) {
    if (!this.enabled) return false;
    const bindings = this.actions.get(action);
    if (!bindings) return false;
    return bindings.some((binding) => this.bindingWasPressed(binding));
  }
  wasReleased(action) {
    if (!this.enabled) return false;
    const bindings = this.actions.get(action);
    if (!bindings) return false;
    return bindings.some((binding) => this.bindingWasReleased(binding));
  }
  /** -1, 0 or 1 from the axis' negative/positive actions. */
  getAxis(axis) {
    if (!this.enabled) return 0;
    const definition = this.axes.get(axis);
    if (!definition) return 0;
    const isDown = (bindings) => bindings.some((binding) => this.bindingIsDown(binding));
    const negative = isDown(definition.negative) ? 1 : 0;
    const positive = isDown(definition.positive) ? 1 : 0;
    return positive - negative;
  }
};

// engine/src/input/Input.ts
var Input = class {
  keyboard = new Keyboard();
  mouse = new Mouse();
  touch = new Touch();
  map;
  /** Camera used to convert pointer positions into world space. Set by the Engine. */
  camera = null;
  attached = false;
  worldPointer = new Vector2();
  constructor(map) {
    this.map = map ?? new InputMap(this);
  }
  attach(options = {}) {
    if (this.attached) return;
    const keyboardTarget = options.keyboardTarget ?? (typeof window !== "undefined" ? window : void 0);
    const pointerTarget = options.pointerTarget ?? options.element ?? (typeof window !== "undefined" ? window : void 0);
    if (keyboardTarget) {
      this.keyboard.attach(keyboardTarget);
      this.keyboard.preventDefaultFor.add("Space");
      this.keyboard.preventDefaultFor.add("ArrowUp");
      this.keyboard.preventDefaultFor.add("ArrowDown");
      this.keyboard.preventDefaultFor.add("ArrowLeft");
      this.keyboard.preventDefaultFor.add("ArrowRight");
    }
    if (pointerTarget) {
      this.mouse.attach(pointerTarget, { element: options.element ?? null });
      this.touch.attach(pointerTarget, {
        element: options.element ?? null,
        preventDefault: options.preventDefault ?? false
      });
    }
    this.attached = true;
  }
  detach() {
    this.keyboard.detach();
    this.mouse.detach();
    this.touch.detach();
    this.attached = false;
  }
  get isAttached() {
    return this.attached;
  }
  isKeyDown(code) {
    return this.keyboard.isDown(code);
  }
  wasKeyPressed(code) {
    return this.keyboard.wasPressed(code);
  }
  isMouseButtonDown(button = 0) {
    return this.mouse.isButtonDown(button);
  }
  wasMouseButtonPressed(button = 0) {
    return this.mouse.wasButtonPressed(button);
  }
  /** Pointer position in element-local pixels. */
  get pointer() {
    return this.mouse.position;
  }
  /**
   * Pointer position in world space, using the assigned camera. Falls back to the raw pixel
   * position when no camera is set, so calling it headlessly never throws.
   */
  pointerWorld(out = this.worldPointer) {
    if (!this.camera) return out.copy(this.mouse.position);
    return this.camera.screenToWorld(this.mouse.position, out);
  }
  get isActionDown() {
    return (action) => this.map.isDown(action);
  }
  reset() {
    this.keyboard.reset();
    this.mouse.reset();
    this.touch.reset();
  }
  /** Clear per-frame edge state across every device. Called by the Engine each step. */
  endFrame() {
    this.keyboard.endFrame();
    this.mouse.endFrame();
    this.touch.endFrame();
  }
};

// engine/src/renderer/Camera.ts
var Camera = class {
  static componentName = "Camera";
  /** Centre of the visible area, in world units. */
  position = new Vector2(0, 0);
  zoom = 1;
  /** Rotation in radians. */
  rotation = 0;
  isMain = true;
  viewportWidth = 0;
  viewportHeight = 0;
  followTarget = null;
  followSmoothing = 0;
  followOffset = new Vector2(0, 0);
  constructor(position) {
    if (position) this.position.copy(Vector2.from(position));
  }
  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    return this;
  }
  setPosition(x, y) {
    this.position.set(x, y);
    return this;
  }
  setZoom(zoom) {
    this.zoom = Math.max(0.01, zoom);
    return this;
  }
  /** Continuously track a transform, optionally with smoothing. */
  follow(target, options = {}) {
    this.followTarget = target;
    this.followSmoothing = Math.max(0, options.smoothing ?? 0);
    this.followOffset.copy(options.offset ?? Vector2.ZERO);
    if (this.followSmoothing === 0) this.snapToTarget();
    return this;
  }
  stopFollowing() {
    this.followTarget = null;
    return this;
  }
  snapToTarget() {
    if (!this.followTarget) return;
    this.position.set(this.followTarget.worldPosition.x, this.followTarget.worldPosition.y).add(this.followOffset);
  }
  /** Advance a smoothed follow. Safe to call every frame whether or not a target is set. */
  update(deltaSeconds) {
    if (!this.followTarget) return;
    const targetX = this.followTarget.worldPosition.x + this.followOffset.x;
    const targetY = this.followTarget.worldPosition.y + this.followOffset.y;
    if (this.followSmoothing === 0) {
      this.position.set(targetX, targetY);
      return;
    }
    const t = 1 - Math.exp(-this.followSmoothing * deltaSeconds);
    this.position.set(this.position.x + (targetX - this.position.x) * t, this.position.y + (targetY - this.position.y) * t);
  }
  /** Half-extents of the visible world area. */
  get visibleHalfExtents() {
    const zoom = this.zoom <= 0 ? 1 : this.zoom;
    return new Vector2(this.viewportWidth / (2 * zoom), this.viewportHeight / (2 * zoom));
  }
  /** World-space rectangle currently visible, expanded for rotation. */
  visibleBounds(out = new Rectangle()) {
    const half = this.visibleHalfExtents;
    const cos = Math.abs(Math.cos(this.rotation));
    const sin = Math.abs(Math.sin(this.rotation));
    const extentX = half.x * cos + half.y * sin;
    const extentY = half.x * sin + half.y * cos;
    return out.set(
      this.position.x - extentX,
      this.position.y - extentY,
      extentX * 2,
      extentY * 2
    );
  }
  /** Convert a world point into viewport pixels (top-left origin). */
  worldToScreen(world, out = new Vector2()) {
    const dx = world.x - this.position.x;
    const dy = world.y - this.position.y;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return out.set(rx * this.zoom + this.viewportWidth / 2, ry * this.zoom + this.viewportHeight / 2);
  }
  /** Convert viewport pixels into a world point. Inverse of `worldToScreen`. */
  screenToWorld(screen, out = new Vector2()) {
    const sx = (screen.x - this.viewportWidth / 2) / (this.zoom <= 0 ? 1 : this.zoom);
    const sy = (screen.y - this.viewportHeight / 2) / (this.zoom <= 0 ? 1 : this.zoom);
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return out.set(this.position.x + sx * cos - sy * sin, this.position.y + sx * sin + sy * cos);
  }
  /** Visibility test used to skip off-screen sprites. */
  isVisible(bounds) {
    return this.visibleBounds().intersects(bounds);
  }
  /** Fit a zoom so `worldSize` fills the viewport, clamped to sensible limits. */
  fit(worldSize, padding = 0) {
    if (worldSize.x <= 0 || worldSize.y <= 0 || this.viewportWidth <= 0 || this.viewportHeight <= 0) return this;
    const zoom = Math.min(
      this.viewportWidth / (worldSize.x + padding * 2),
      this.viewportHeight / (worldSize.y + padding * 2)
    );
    return this.setZoom(clamp(zoom, 0.01, 100));
  }
  toJSON() {
    return {
      position: this.position.toArray(),
      zoom: this.zoom,
      rotation: this.rotation,
      isMain: this.isMain
    };
  }
};

// engine/src/systems/InputSystem.ts
var InputSystem = class _InputSystem {
  name = "InputSystem";
  priority = SystemPriority.Input;
  input = null;
  initialize(world) {
    this.input = world.services.input ?? null;
    this.syncCamera(world);
  }
  update(world) {
    this.syncCamera(world);
  }
  syncCamera(world) {
    if (!this.input) return;
    const explicit = world.services.camera ?? null;
    this.input.camera = explicit ?? _InputSystem.findSceneCamera(world);
  }
  /** First Camera component in the active scene, used when no camera was supplied explicitly. */
  static findSceneCamera(world) {
    const match = world.query(Camera).first();
    return match ? match.components[0] : null;
  }
};

// engine/src/systems/TransformSystem.ts
var TransformSystem = class {
  name = "TransformSystem";
  priority = SystemPriority.Transform;
  profiler = null;
  visited = /* @__PURE__ */ new Set();
  initialize(world) {
    this.profiler = world.services.profiler ?? null;
  }
  update(world) {
    this.profiler?.begin(this.name);
    try {
      const storage = world.components.storageFor(Transform);
      if (!storage || storage.size === 0) return;
      this.visited.clear();
      const roots = [];
      for (const [id, transform] of storage) {
        const parentId = transform.parent;
        const parentHasTransform = parentId !== null && world.components.has(parentId, Transform);
        if (!parentHasTransform) {
          transform.parent = null;
          roots.push(id);
          continue;
        }
        const parentTransform = world.components.get(parentId, Transform);
        if (parentTransform && !parentTransform.children.includes(id)) parentTransform.children.push(id);
      }
      for (const id of roots) this.computeWorld(world, id, null);
      for (const [id, transform] of storage) {
        if (this.visited.has(id)) continue;
        transform.parent = null;
        this.computeWorld(world, id, null);
      }
    } finally {
      this.profiler?.end(this.name);
    }
  }
  computeWorld(world, id, parent) {
    if (this.visited.has(id)) return;
    this.visited.add(id);
    const transform = world.components.get(id, Transform);
    if (!transform) return;
    if (!parent) {
      transform.worldPosition.copy(transform.position);
      transform.worldRotation = transform.rotation;
      transform.worldScale.copy(transform.scale);
    } else {
      const cos = Math.cos(parent.worldRotation);
      const sin = Math.sin(parent.worldRotation);
      const scaledX = transform.position.x * parent.worldScale.x;
      const scaledY = transform.position.y * parent.worldScale.y;
      transform.worldPosition.set(
        parent.worldPosition.x + scaledX * cos - scaledY * sin,
        parent.worldPosition.y + scaledX * sin + scaledY * cos
      );
      transform.worldRotation = parent.worldRotation + transform.rotation;
      transform.worldScale.set(
        parent.worldScale.x * transform.scale.x,
        parent.worldScale.y * transform.scale.y
      );
    }
    transform.clearDirty();
    for (const childId of transform.children) {
      if (!world.components.has(childId, Transform)) continue;
      this.computeWorld(world, childId, transform);
    }
  }
};

// engine/src/scripting/Script.ts
var Script = class {
  /** Typed as `string` so a subclass may narrow it to its own name without a static-side error. */
  static componentName = "Script";
  /** Set by ScriptSystem when the script is attached to a live entity. */
  entity = -1;
  /** Set by ScriptSystem. Convenience for `world.entity(this.entity)`. */
  world = null;
  /** Disabled scripts keep their state but are skipped by ScriptSystem. */
  enabled = true;
  started = false;
  destroyed = false;
  get hasStarted() {
    return this.started;
  }
  get isDestroyed() {
    return this.destroyed;
  }
  /** Called once, before the first `onUpdate`. */
  onStart() {
  }
  /** Called every simulation step while `enabled` is true. */
  onUpdate(_deltaSeconds) {
  }
  /** Called once when the entity or component is removed. */
  onDestroy() {
  }
  /**
   * Called when `enabled` flips. Useful for pausing timers without losing state, which
   * `onDestroy` cannot do.
   */
  onEnabledChanged(_enabled) {
  }
  /** Shorthand for the component lookup most scripts perform. */
  getComponent(type) {
    return this.world && this.entity >= 0 ? this.world.getComponent(this.entity, type) : void 0;
  }
  /**
   * Component hook: fires when the component is removed or its entity is destroyed.
   *
   * This is the only reliable teardown point - by the time `entity:destroyed` is emitted the
   * component store has already dropped the component, so a listener could never find it.
   */
  onDetach() {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.onDestroy();
    } catch (error) {
      console.error("[gameforge] error in script onDestroy", error);
    }
  }
  /* ---------------------------------------------------------------- internal */
  /** @internal - driven by ScriptSystem. */
  markStarted() {
    this.started = true;
  }
  /** @internal - driven by ScriptSystem. */
  markDestroyed() {
    this.destroyed = true;
  }
};

// engine/src/scripting/Lifecycle.ts
function scriptLabel(script) {
  const type = script.constructor;
  return componentTypeName(type) || "Script";
}
function invokeOnStart(script, options = {}) {
  if (script.hasStarted || script.isDestroyed) return false;
  try {
    if (options.trace) console.debug(`[gameforge] onStart ${scriptLabel(script)}#${script.entity}`);
    script.markStarted();
    script.onStart();
    return true;
  } catch (error) {
    options.onError?.(error, `${scriptLabel(script)}#${script.entity}.onStart`, script);
    return false;
  }
}
function invokeOnUpdate(script, deltaSeconds, options = {}) {
  if (script.isDestroyed || !script.hasStarted) return false;
  try {
    script.onUpdate(deltaSeconds);
    return true;
  } catch (error) {
    options.onError?.(error, `${scriptLabel(script)}#${script.entity}.onUpdate`, script);
    return false;
  }
}
function invokeOnDestroy(script, options = {}) {
  if (script.isDestroyed) return false;
  try {
    script.markDestroyed();
    script.onDestroy();
    return true;
  } catch (error) {
    options.onError?.(error, `${scriptLabel(script)}#${script.entity}.onDestroy`, script);
    return false;
  }
}

// engine/src/systems/ScriptSystem.ts
function isScriptClass(type) {
  if (type === Script) return true;
  const prototype = type.prototype;
  return typeof prototype === "object" && prototype !== null && Script.prototype.isPrototypeOf(prototype);
}
var ScriptSystem = class {
  name = "ScriptSystem";
  priority = SystemPriority.Script;
  options;
  profiler = null;
  startedCount = 0;
  updatedCount = 0;
  initialized = false;
  pendingDestroy = /* @__PURE__ */ new Set();
  /** Concrete script classes seen so far, rebuilt only when the set of component types grows. */
  scriptTypes = /* @__PURE__ */ new Set();
  knownTypeCount = -1;
  constructor(options = {}) {
    this.options = options;
  }
  initialize(world) {
    this.profiler = world.services.profiler ?? null;
    if (this.initialized) return;
    this.initialized = true;
  }
  /** Every live script component, gathered across the concrete script classes in use. */
  collectScripts(world) {
    const types = world.components.registeredTypes();
    if (types.length !== this.knownTypeCount) {
      this.knownTypeCount = types.length;
      this.scriptTypes.clear();
      for (const type of types) {
        if (isScriptClass(type)) this.scriptTypes.add(type);
      }
    }
    const entries = [];
    for (const type of this.scriptTypes) {
      const storage = world.components.storageFor(type);
      if (!storage) continue;
      for (const [entityId, component] of storage) entries.push([entityId, component]);
    }
    entries.sort((a, b) => a[0] - b[0]);
    return entries;
  }
  update(world, deltaSeconds) {
    this.profiler?.begin(this.name);
    this.startedCount = 0;
    this.updatedCount = 0;
    try {
      const entries = this.collectScripts(world);
      if (entries.length === 0) return;
      for (const [entityId, script] of entries) {
        if (script.isDestroyed) continue;
        if (!world.isAlive(entityId)) {
          this.destroyScript(script);
          continue;
        }
        if (script.entity !== entityId) {
          script.entity = entityId;
          script.world = world;
        }
        if (!script.hasStarted) {
          if (invokeOnStart(script, this.options)) this.startedCount += 1;
          if (script.isDestroyed) continue;
        }
        if (!script.enabled) continue;
        if (invokeOnUpdate(script, deltaSeconds, this.options)) this.updatedCount += 1;
      }
    } finally {
      this.profiler?.end(this.name);
    }
  }
  /** Force a script's teardown, e.g. when a system is removed at runtime. */
  destroyScript(script) {
    if (script.isDestroyed) return;
    this.pendingDestroy.delete(script);
    invokeOnDestroy(script, this.options);
  }
  get lastFrameStats() {
    return { started: this.startedCount, updated: this.updatedCount };
  }
  dispose() {
    this.profiler = null;
  }
};

// engine/src/systems/RenderSystem.ts
var RenderSystem = class {
  name = "RenderSystem";
  priority = SystemPriority.Render;
  renderer;
  cameraOverride;
  clearColor;
  cull;
  metrics = null;
  profiler = null;
  fallbackCamera = new Camera();
  cameraSource = "fallback";
  constructor(options) {
    this.renderer = options.renderer;
    this.cameraOverride = options.camera ?? null;
    this.clearColor = typeof options.clearColor === "string" ? Color.fromHex(options.clearColor) : options.clearColor ?? Color.fromHex("#0b1020");
    this.cull = options.cull ?? true;
  }
  initialize(world) {
    this.metrics = world.services.metrics ?? null;
    this.profiler = world.services.profiler ?? null;
  }
  setCamera(camera) {
    this.cameraOverride = camera;
  }
  render(world, _alpha) {
    this.profiler?.begin(this.name);
    try {
      const queue = world.renderQueue;
      const camera = this.resolveCamera(world);
      this.renderer.beginFrame({ clearColor: this.clearColor, camera });
      const visibleBounds = this.cull ? camera.visibleBounds() : null;
      for (const match of world.query(Sprite, Transform)) {
        const sprite = match.components[0];
        const transform = match.components[1];
        if (!sprite.visible || sprite.opacity <= 0) continue;
        if (visibleBounds) {
          const bounds = sprite.bounds(transform);
          if (!visibleBounds.intersects(bounds)) continue;
        }
        queue.add(this.buildQuad(match.entity, sprite, transform));
      }
      const drawn = queue.flush(this.renderer);
      this.renderer.endFrame();
      this.metrics?.recordRender({ ...this.renderer.stats, drawCalls: drawn });
    } finally {
      this.profiler?.end(this.name);
    }
  }
  buildQuad(entity, sprite, transform) {
    void entity;
    const material = sprite.material;
    return {
      kind: "quad",
      x: transform.worldPosition.x,
      y: transform.worldPosition.y,
      width: sprite.width,
      height: sprite.height,
      originX: sprite.originOffset.x,
      originY: sprite.originOffset.y,
      rotation: transform.worldRotation,
      material,
      alpha: 1,
      layer: sprite.layer + transform.zIndex,
      blend: material.blend,
      flipX: sprite.flipX,
      flipY: sprite.flipY
    };
  }
  resolveCamera(world) {
    if (this.cameraOverride) {
      this.cameraSource = "override";
      return this.syncViewport(this.cameraOverride);
    }
    const sceneCamera = world.query(Camera).first();
    if (sceneCamera) {
      const camera = sceneCamera.components[0];
      if (world.hasComponent(sceneCamera.entity, Transform)) {
        const transform = world.components.get(sceneCamera.entity, Transform);
        if (transform) camera.position.copy(transform.worldPosition);
      }
      this.cameraSource = "scene";
      return this.syncViewport(camera);
    }
    this.cameraSource = "fallback";
    return this.syncViewport(this.fallbackCamera);
  }
  syncViewport(camera) {
    if (camera.viewportWidth !== this.renderer.width || camera.viewportHeight !== this.renderer.height) {
      camera.setViewport(this.renderer.width, this.renderer.height);
    }
    return camera;
  }
  /** Where the active camera came from - surfaced in diagnostics. */
  get activeCameraSource() {
    return this.cameraSource;
  }
  dispose() {
    this.metrics = null;
    this.profiler = null;
  }
};

// engine/src/renderer/RenderContext.ts
function createRenderStats() {
  return { frames: 0, drawCalls: 0, quads: 0, circles: 0, lines: 0, layers: 0, drawTimeMs: 0 };
}
function resetRenderStats(stats) {
  stats.drawCalls = 0;
  stats.quads = 0;
  stats.circles = 0;
  stats.lines = 0;
  stats.layers = 0;
  stats.drawTimeMs = 0;
}

// engine/src/renderer/Renderer.ts
var BaseRenderer = class {
  stats = createRenderStats();
  viewportWidthValue = 0;
  viewportHeightValue = 0;
  pixelRatioValue = 1;
  currentCamera = null;
  get width() {
    return this.viewportWidthValue;
  }
  get height() {
    return this.viewportHeightValue;
  }
  get pixelRatio() {
    return this.pixelRatioValue;
  }
  async initialize() {
  }
  resize(width, height, pixelRatio = 1) {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error(`Renderer.resize received invalid size ${width}x${height}`);
    }
    this.viewportWidthValue = width;
    this.viewportHeightValue = height;
    this.pixelRatioValue = pixelRatio;
  }
  beginFrame(options = {}) {
    resetRenderStats(this.stats);
    this.stats.frames += 1;
    this.currentCamera = options.camera ?? null;
    const started = now();
    this.clear(options.clearColor ?? Color.BLACK);
    this.stats.drawTimeMs = now() - started;
  }
  endFrame() {
  }
  draw(command) {
    const started = now();
    switch (command.kind) {
      case "quad":
        this.stats.quads += 1;
        this.drawQuadCommand(command);
        break;
      case "circle":
        this.stats.circles += 1;
        this.drawCircleCommand(command);
        break;
      case "line":
        this.stats.lines += 1;
        this.drawLineCommand(command);
        break;
    }
    this.stats.drawCalls += 1;
    this.stats.drawTimeMs += now() - started;
  }
  dispose() {
    this.currentCamera = null;
  }
};
function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// engine/src/renderer/Canvas2DRenderer.ts
var BLEND_MODES = {
  normal: "source-over",
  additive: "lighter",
  multiply: "multiply"
};
var Canvas2DRenderer = class extends BaseRenderer {
  backend = "canvas2d";
  capabilities = {
    backend: "canvas2d",
    supportsTextures: true,
    supportsRotation: true,
    supportsBlending: true,
    supportsLines: true,
    maxTextureSize: 16384,
    headless: false
  };
  canvas;
  context = null;
  pixelArt;
  constructor(canvas, options = {}) {
    super();
    this.canvas = canvas;
    this.pixelArt = options.pixelArt ?? false;
    this.capabilities.headless = canvas === null;
  }
  /** Cheap capability probe so the engine can pick a backend before constructing it. */
  static isSupported(canvas) {
    if (!canvas && typeof document === "undefined") return false;
    if (!canvas) return false;
    try {
      return canvas.getContext("2d") !== null;
    } catch {
      return false;
    }
  }
  async initialize() {
    if (!this.canvas) return;
    this.context = this.canvas.getContext("2d", { alpha: false });
    if (!this.context) throw new Error("Canvas2DRenderer: 2D context is unavailable on this canvas");
    this.context.imageSmoothingEnabled = !this.pixelArt;
  }
  resize(width, height, pixelRatio = 1) {
    super.resize(width, height, pixelRatio);
    if (!this.canvas) return;
    const backingWidth = Math.max(1, Math.round(width * pixelRatio));
    const backingHeight = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
    if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
    if (this.context) this.context.imageSmoothingEnabled = !this.pixelArt;
  }
  clear(color) {
    const ctx = this.context;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (color.a >= 1) {
      ctx.fillStyle = color.toCss();
      ctx.fillRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    } else {
      ctx.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
      if (color.a > 0) {
        ctx.fillStyle = color.toCss();
        ctx.fillRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
      }
    }
    this.applyCameraTransform();
  }
  /** World -> viewport transform, applied once per frame rather than per draw call. */
  applyCameraTransform() {
    const ctx = this.context;
    if (!ctx) return;
    ctx.setTransform(this.pixelRatioValue, 0, 0, this.pixelRatioValue, 0, 0);
    const camera = this.currentCamera;
    if (!camera) return;
    ctx.translate(camera.viewportWidth / 2, camera.viewportHeight / 2);
    if (camera.rotation !== 0) ctx.rotate(camera.rotation);
    if (camera.zoom !== 1) ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.position.x, -camera.position.y);
  }
  drawQuadCommand(command) {
    const ctx = this.context;
    if (!ctx) return;
    const alpha = command.alpha * command.material.opacity * command.material.color.a;
    if (alpha <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = BLEND_MODES[command.blend] ?? "source-over";
    const needsTransform = command.rotation !== 0 || command.flipX || command.flipY;
    const left = -command.originX;
    const top = -command.originY;
    const drawBody = () => {
      const material = command.material;
      if (material.isTextured && material.texture?.source) {
        const uv = material.uvRect;
        if (uv) {
          ctx.drawImage(
            material.texture.source,
            uv.x,
            uv.y,
            uv.width,
            uv.height,
            left,
            top,
            command.width,
            command.height
          );
          return;
        }
      }
      ctx.fillStyle = material.color.toCss();
      ctx.fillRect(left, top, command.width, command.height);
    };
    if (!needsTransform) {
      ctx.save();
      ctx.translate(command.x, command.y);
      drawBody();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(command.x, command.y);
    if (command.rotation !== 0) ctx.rotate(command.rotation);
    if (command.flipX || command.flipY) ctx.scale(command.flipX ? -1 : 1, command.flipY ? -1 : 1);
    drawBody();
    ctx.restore();
  }
  drawCircleCommand(command) {
    const ctx = this.context;
    if (!ctx) return;
    const alpha = command.alpha * command.color.a;
    if (alpha <= 0 || command.radius <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = BLEND_MODES[command.blend] ?? "source-over";
    ctx.beginPath();
    ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2);
    if (command.filled) {
      ctx.fillStyle = command.color.toCss();
      ctx.fill();
    } else {
      ctx.strokeStyle = command.color.toCss();
      ctx.lineWidth = Math.max(0.1, command.lineWidth);
      ctx.stroke();
    }
  }
  drawLineCommand(command) {
    const ctx = this.context;
    if (!ctx) return;
    const alpha = command.alpha * command.color.a;
    if (alpha <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = BLEND_MODES[command.blend] ?? "source-over";
    ctx.beginPath();
    ctx.moveTo(command.x1, command.y1);
    ctx.lineTo(command.x2, command.y2);
    ctx.strokeStyle = command.color.toCss();
    ctx.lineWidth = Math.max(0.1, command.width);
    ctx.stroke();
  }
  dispose() {
    this.context = null;
    super.dispose();
  }
};

// engine/src/assets/cache/AssetCache.ts
var AssetCache = class {
  entries = /* @__PURE__ */ new Map();
  refCounts = /* @__PURE__ */ new Map();
  capacity;
  constructor(capacity = Number.POSITIVE_INFINITY) {
    this.capacity = Math.max(1, capacity);
  }
  get size() {
    return this.entries.size;
  }
  get keys() {
    return Array.from(this.entries.keys());
  }
  has(id) {
    return this.entries.has(id);
  }
  get(id) {
    return this.entries.get(id);
  }
  /** Store an asset and mark it as referenced once. */
  set(id, value) {
    this.entries.set(id, value);
    this.refCounts.set(id, (this.refCounts.get(id) ?? 0) + 1);
  }
  /** Increase the reference count for an existing entry. */
  retain(id) {
    if (!this.entries.has(id)) return false;
    this.refCounts.set(id, (this.refCounts.get(id) ?? 0) + 1);
    return true;
  }
  /** Decrease the reference count. The entry stays until `prune()` runs. */
  release(id) {
    const count = this.refCounts.get(id);
    if (count === void 0) return false;
    if (count <= 1) this.refCounts.set(id, 0);
    else this.refCounts.set(id, count - 1);
    return true;
  }
  referenceCount(id) {
    return this.refCounts.get(id) ?? 0;
  }
  /** Drop every unreferenced entry. Returns the ids that were evicted. */
  prune() {
    const evicted = [];
    for (const id of Array.from(this.entries.keys())) {
      if ((this.refCounts.get(id) ?? 0) <= 0) {
        this.entries.delete(id);
        this.refCounts.delete(id);
        evicted.push(id);
      }
    }
    return evicted;
  }
  delete(id) {
    this.refCounts.delete(id);
    return this.entries.delete(id);
  }
  clear() {
    this.entries.clear();
    this.refCounts.clear();
  }
  /** True when the cache is at capacity; the manager uses this to prune after a load batch. */
  get isFull() {
    return this.entries.size >= this.capacity;
  }
};

// engine/src/assets/AssetHandle.ts
var AssetHandle = class {
  id;
  type;
  source;
  stateValue = "pending";
  valueValue;
  errorValue = null;
  resolveFn;
  rejectFn;
  /** Resolves with the asset, or rejects with the load error. */
  promise;
  constructor(id, type, source) {
    this.id = id;
    this.type = type;
    this.source = source;
    this.promise = new Promise((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
    this.promise.catch(() => void 0);
  }
  get state() {
    return this.stateValue;
  }
  get isPending() {
    return this.stateValue === "pending";
  }
  get isLoading() {
    return this.stateValue === "loading" || this.stateValue === "pending";
  }
  get isReady() {
    return this.stateValue === "ready";
  }
  get isFailed() {
    return this.stateValue === "failed";
  }
  /** The loaded asset. Throws when it is not ready, so misuse surfaces immediately. */
  get value() {
    if (this.stateValue !== "ready") {
      throw new Error(`Asset "${this.id}" is ${this.stateValue}, not ready`);
    }
    return this.valueValue;
  }
  /** The loaded asset, or undefined when it is not ready yet. */
  get maybeValue() {
    return this.stateValue === "ready" ? this.valueValue : void 0;
  }
  get error() {
    return this.errorValue;
  }
  /** @internal - called by AssetManager. */
  markLoading() {
    if (this.stateValue === "pending") this.stateValue = "loading";
  }
  /** @internal - called by AssetManager. */
  markReady(value) {
    this.stateValue = "ready";
    this.valueValue = value;
    this.resolveFn(value);
  }
  /** @internal - called by AssetManager. */
  markFailed(error) {
    this.stateValue = "failed";
    this.errorValue = error;
    this.rejectFn(error);
  }
  /** @internal - reset for a reload (development hot reload). */
  reset() {
    this.stateValue = "pending";
    this.valueValue = void 0;
    this.errorValue = null;
  }
  toString() {
    return `AssetHandle(${this.id} [${this.type}] ${this.stateValue})`;
  }
};

// engine/src/assets/AssetManifest.ts
var ASSET_MANIFEST_VERSION = 1;
var KNOWN_TYPES = ["texture", "json", "text"];
var HASH_PATTERN = /^sha256:[0-9a-f]{8,64}$/i;
function validateAssetManifest(manifest) {
  const problems = [];
  if (typeof manifest !== "object" || manifest === null) {
    return ["manifest must be an object"];
  }
  const candidate = manifest;
  if (candidate.version !== ASSET_MANIFEST_VERSION) {
    problems.push(`version must be ${ASSET_MANIFEST_VERSION}, received ${String(candidate.version)}`);
  }
  if (!Array.isArray(candidate.assets)) {
    problems.push("assets must be an array");
    return problems;
  }
  const seen = /* @__PURE__ */ new Set();
  candidate.assets.forEach((entry, index) => {
    const at = `assets[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      problems.push(`${at} must be an object`);
      return;
    }
    const item = entry;
    if (typeof item.id !== "string" || item.id.length === 0) problems.push(`${at}.id must be a non-empty string`);
    else if (seen.has(item.id)) problems.push(`${at}.id "${item.id}" is duplicated`);
    else seen.add(item.id);
    if (typeof item.type !== "string" || !KNOWN_TYPES.includes(item.type)) {
      problems.push(`${at}.type must be one of ${KNOWN_TYPES.join(", ")}`);
    }
    if (typeof item.source !== "string" || item.source.length === 0) {
      problems.push(`${at}.source must be a non-empty string`);
    }
    if (item.hash !== void 0 && !HASH_PATTERN.test(item.hash)) {
      problems.push(`${at}.hash must look like sha256:<hex>`);
    }
    if (item.size !== void 0 && (!Number.isInteger(item.size) || item.size < 0)) {
      problems.push(`${at}.size must be a non-negative integer`);
    }
  });
  return problems;
}
function parseAssetManifest(data) {
  const problems = validateAssetManifest(data);
  if (problems.length > 0) {
    throw new Error(`Invalid asset manifest:
  - ${problems.join("\n  - ")}`);
  }
  return data;
}
function createAssetManifest(assets, basePath) {
  return { version: ASSET_MANIFEST_VERSION, basePath, assets };
}
function findManifestEntry(manifest, id) {
  return manifest.assets.find((entry) => entry.id === id);
}

// engine/src/assets/loaders/JsonLoader.ts
var JsonLoader = class {
  constructor(fetchImpl = globalThis.fetch) {
    this.fetchImpl = fetchImpl;
  }
  fetchImpl;
  type = "json";
  async load(source, entry) {
    const response = await this.fetchImpl(source, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load JSON "${entry.id}": HTTP ${response.status} for ${source}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Asset "${entry.id}" is not valid JSON (${source}): ${error.message}`);
    }
  }
};

// engine/src/assets/loaders/TextLoader.ts
var TextLoader = class {
  constructor(fetchImpl = globalThis.fetch) {
    this.fetchImpl = fetchImpl;
  }
  fetchImpl;
  type = "text";
  async load(source, entry) {
    const response = await this.fetchImpl(source, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load text "${entry.id}": HTTP ${response.status} for ${source}`);
    }
    return response.text();
  }
};

// engine/src/renderer/Texture.ts
var nextTextureId = 1;
var Texture = class _Texture {
  id;
  width;
  height;
  source;
  label;
  /** Populated when the texture is a plain colour rather than an image. */
  solidColor;
  disposed = false;
  constructor(source, width, height, label, solidColor) {
    this.id = nextTextureId++;
    this.source = source;
    this.width = width;
    this.height = height;
    this.label = label;
    this.solidColor = solidColor;
  }
  /** Wrap a decoded image. Size is taken from the element unless overridden. */
  static fromSource(source, options = {}) {
    const width = options.width ?? source.width ?? 0;
    const height = options.height ?? source.height ?? 0;
    return new _Texture(source, width, height, options.label ?? "texture", null);
  }
  /**
   * Build a 1x1 texture of a flat colour. Used for untextured sprites and debug primitives so the
   * renderer has a single code path for "draw a quad".
   */
  static solid(color, label = "solid") {
    if (typeof OffscreenCanvas === "function") {
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = color.toCss();
        ctx.fillRect(0, 0, 1, 1);
        return new _Texture(canvas, 1, 1, `${label}:${color.toHex()}`, color.clone());
      }
    }
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = color.toCss();
        ctx.fillRect(0, 0, 1, 1);
        return new _Texture(canvas, 1, 1, `${label}:${color.toHex()}`, color.clone());
      }
    }
    return new _Texture(null, 1, 1, `${label}:${color.toHex()}`, color.clone());
  }
  get size() {
    return new Vector2(this.width, this.height);
  }
  get aspect() {
    return this.height === 0 ? 1 : this.width / this.height;
  }
  get isDisposed() {
    return this.disposed;
  }
  /** Marks the texture unusable. The backing image is owned by the asset cache, not by us. */
  dispose() {
    this.disposed = true;
  }
};

// engine/src/assets/loaders/TextureLoader.ts
var TextureLoader = class {
  type = "texture";
  async load(source, entry) {
    if (typeof Image === "undefined") {
      throw new Error(`TextureLoader cannot decode "${entry.id}" outside a browser (no Image constructor)`);
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    const loaded = new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to load texture "${entry.id}" from ${source}`));
    });
    image.src = source;
    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch {
        await loaded;
      }
    } else {
      await loaded;
    }
    if (image.naturalWidth === 0) {
      throw new Error(`Texture "${entry.id}" decoded to zero width (${source})`);
    }
    return Texture.fromSource(image, { label: entry.id });
  }
};

// engine/src/assets/AssetManager.ts
var AssetManager = class {
  loaders = /* @__PURE__ */ new Map();
  handles = /* @__PURE__ */ new Map();
  cache;
  events;
  logger;
  manifestValue = null;
  basePathValue;
  loadedCount = 0;
  failedCount = 0;
  currentId = null;
  fetchImpl;
  constructor(options = {}) {
    this.basePathValue = options.basePath ?? "";
    this.events = options.events ?? null;
    this.logger = options.logger ?? null;
    this.cache = new AssetCache(options.cacheCapacity);
    if (options.fetchImpl) this.fetchImpl = options.fetchImpl.bind(globalThis);
    else if (typeof globalThis.fetch === "function") this.fetchImpl = globalThis.fetch.bind(globalThis);
    else this.fetchImpl = (() => Promise.reject(new Error("No fetch implementation available")));
    const defaults = [
      new TextureLoader(),
      new JsonLoader(this.fetchImpl),
      new TextLoader(this.fetchImpl)
    ];
    for (const loader of [...defaults, ...options.loaders ?? []]) this.registerLoader(loader);
  }
  registerLoader(loader) {
    this.loaders.set(loader.type, loader);
    return this;
  }
  /* ------------------------------------------------------------------ manifest */
  /** Attach a manifest object, or fetch and validate one from a URL. */
  async loadManifest(source) {
    if (typeof source === "string") {
      const response = await this.fetchImpl(source, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Failed to load asset manifest ${source}: HTTP ${response.status}`);
      }
      const manifest = parseAssetManifest(await response.json());
      if (!manifest.basePath && !this.basePathValue) {
        const index = source.lastIndexOf("/");
        this.basePathValue = index >= 0 ? source.slice(0, index + 1) : "";
      }
      this.manifestValue = manifest;
      this.logger?.debug("asset manifest loaded", { assets: manifest.assets.length, basePath: this.basePathValue });
      return manifest;
    }
    this.manifestValue = parseAssetManifest(source);
    return this.manifestValue;
  }
  get manifest() {
    return this.manifestValue;
  }
  get basePath() {
    return this.basePathValue;
  }
  setBasePath(basePath) {
    this.basePathValue = basePath;
  }
  resolveSource(entry) {
    if (/^[a-z]+:\/\//i.test(entry.source) || entry.source.startsWith("/")) return entry.source;
    const base = this.basePathValue;
    if (!base) return entry.source;
    return base.endsWith("/") ? `${base}${entry.source}` : `${base}/${entry.source}`;
  }
  /* ------------------------------------------------------------------ requesting */
  /**
   * Request an asset by id. Returns a handle immediately; the same handle is returned for repeat
   * requests, which is what de-duplicates concurrent loads.
   */
  request(id) {
    const existing = this.handles.get(id);
    if (existing) return existing;
    const entry = this.manifestValue ? findManifestEntry(this.manifestValue, id) : void 0;
    if (!entry) {
      const missing = new AssetHandle(id, "json", id);
      missing.markFailed(new Error(`Asset "${id}" is not declared in the manifest`));
      return missing;
    }
    const handle = new AssetHandle(id, entry.type, this.resolveSource(entry));
    this.handles.set(id, handle);
    void this.startLoad(handle, entry);
    return handle;
  }
  /** Await an asset, rejecting on failure. */
  async load(id) {
    return this.request(id).promise;
  }
  /** Await an asset, resolving to null on failure - handy for optional assets. */
  async tryLoad(id) {
    try {
      return await this.request(id).promise;
    } catch {
      return null;
    }
  }
  async startLoad(handle, entry) {
    const loader = this.loaders.get(entry.type);
    if (!loader) {
      const error = new Error(`No loader registered for asset type "${entry.type}" (asset "${entry.id}")`);
      this.fail(handle, error);
      return;
    }
    handle.markLoading();
    this.currentId = entry.id;
    try {
      const value = await loader.load(this.resolveSource(entry), entry);
      this.cache.set(entry.id, value);
      handle.markReady(value);
      this.loadedCount += 1;
      this.events?.emit("asset:progress", {
        loaded: this.loadedCount,
        total: this.totalRequested,
        id: entry.id
      });
      this.currentId = null;
    } catch (error) {
      this.fail(handle, error instanceof Error ? error : new Error(String(error)));
    }
  }
  fail(handle, error) {
    handle.markFailed(error);
    this.failedCount += 1;
    this.currentId = null;
    this.logger?.warn(`asset failed: ${handle.id}`, error.message);
    this.events?.emit("asset:failed", { id: handle.id, error });
  }
  /** Synchronous access once an asset is ready. */
  get(id) {
    return this.cache.get(id);
  }
  has(id) {
    return this.cache.has(id);
  }
  handleFor(id) {
    return this.handles.get(id);
  }
  isLoading(id) {
    const handle = this.handles.get(id);
    return handle ? handle.isLoading : false;
  }
  /* ------------------------------------------------------------------ bulk loading */
  /** Load every asset declared in the manifest. Failures are collected, never fatal. */
  async preloadAll() {
    if (!this.manifestValue) throw new Error("preloadAll requires a manifest; call loadManifest first");
    const started = Date.now();
    const entries = this.manifestValue.assets;
    this.events?.emit("asset:started", { count: entries.length });
    const results = await Promise.allSettled(entries.map((entry) => this.load(entry.id)));
    const failed = [];
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        failed.push({ id: entries[index].id, error: String(result.reason?.message ?? result.reason) });
      }
    });
    const report = {
      total: entries.length,
      loaded: entries.length - failed.length,
      failed,
      elapsedMs: Date.now() - started
    };
    this.events?.emit("asset:complete", { count: report.loaded, elapsedMs: report.elapsedMs });
    return report;
  }
  /** Register an asset that was produced at runtime instead of loaded (solid colours, atlases). */
  registerAsset(id, type, value) {
    const handle = new AssetHandle(id, type, "<runtime>");
    this.cache.set(id, value);
    handle.markReady(value);
    this.handles.set(id, handle);
    return handle;
  }
  /* ------------------------------------------------------------------ lifecycle */
  get progress() {
    const total = this.totalRequested;
    return {
      loaded: this.loadedCount,
      total,
      ratio: total === 0 ? 1 : this.loadedCount / total,
      currentId: this.currentId
    };
  }
  get totalRequested() {
    return this.handles.size;
  }
  get stats() {
    return {
      requested: this.totalRequested,
      loaded: this.loadedCount,
      failed: this.failedCount,
      cached: this.cache.size
    };
  }
  /** Drop an asset and its handle so a later request reloads it (development hot reload). */
  unload(id) {
    this.handles.delete(id);
    return this.cache.delete(id);
  }
  clear() {
    this.handles.clear();
    this.cache.clear();
    this.loadedCount = 0;
    this.failedCount = 0;
    this.currentId = null;
  }
  /** Build a manifest in code - used by tests and by the browser-first examples. */
  static manifestFrom(entries, basePath) {
    return createAssetManifest(entries, basePath);
  }
};

// engine/src/diagnostics/Logger.ts
var LEVEL_ORDER = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
var Logger = class _Logger {
  levelValue;
  scopeValue;
  sinks = [];
  mirror;
  historyLimit;
  history = [];
  constructor(options = {}) {
    this.levelValue = options.level ?? "info";
    this.scopeValue = options.scope ?? "gameforge";
    this.mirror = options.mirrorToConsole ?? true;
    this.historyLimit = Math.max(0, options.historyLimit ?? 200);
    if (options.sinks) this.sinks.push(...options.sinks);
  }
  setLevel(level) {
    this.levelValue = level;
  }
  get level() {
    return this.levelValue;
  }
  addSink(sink) {
    this.sinks.push(sink);
    return () => {
      const index = this.sinks.indexOf(sink);
      if (index !== -1) this.sinks.splice(index, 1);
    };
  }
  /** Derive a logger that prefixes a scope, sharing level, sinks and history. */
  child(scope) {
    const child = new _Logger({ level: this.levelValue, scope, mirrorToConsole: this.mirror, historyLimit: this.historyLimit });
    this.sinks.push((entry) => child.record(entry));
    return child;
  }
  /** Write a pre-formed entry; used by `child` and by external bridges. */
  record(entry) {
    if (LEVEL_ORDER[entry.level] > LEVEL_ORDER[this.levelValue]) return;
    if (this.historyLimit > 0) {
      this.history.push(entry);
      if (this.history.length > this.historyLimit) this.history.shift();
    }
    for (const sink of this.sinks) sink(entry);
  }
  error(message, detail) {
    this.write("error", message, detail);
  }
  warn(message, detail) {
    this.write("warn", message, detail);
  }
  info(message, detail) {
    this.write("info", message, detail);
  }
  debug(message, detail) {
    this.write("debug", message, detail);
  }
  write(level, message, detail) {
    if (LEVEL_ORDER[level] > LEVEL_ORDER[this.levelValue]) return;
    let serialisedDetail;
    if (detail !== void 0) {
      try {
        serialisedDetail = typeof detail === "string" ? detail : JSON.stringify(detail);
      } catch {
        serialisedDetail = String(detail);
      }
    }
    const entry = {
      level,
      scope: this.scopeValue,
      message,
      timestamp: typeof performance !== "undefined" ? performance.now() : Date.now(),
      detail: serialisedDetail
    };
    this.record(entry);
    if (this.mirror) this.mirrorEntry(entry);
  }
  mirrorEntry(entry) {
    if (typeof console === "undefined") return;
    const prefix = `[${entry.scope}]`;
    const text = entry.detail ? `${entry.message} ${entry.detail}` : entry.message;
    switch (entry.level) {
      case "error":
        console.error(prefix, text);
        break;
      case "warn":
        console.warn(prefix, text);
        break;
      case "debug":
        console.debug(prefix, text);
        break;
      default:
        console.log(prefix, text);
    }
  }
  /** Recent entries, oldest first. */
  get entries() {
    return this.history;
  }
  /** Recent entries filtered by level, for the runtime console. */
  entriesAt(level) {
    return this.history.filter((entry) => entry.level === level);
  }
  clearHistory() {
    this.history.length = 0;
  }
};

// engine/src/diagnostics/Metrics.ts
var Metrics = class {
  samples = [];
  windowSize;
  framesValue = 0;
  updateStepsValue = 0;
  entitiesValue = 0;
  drawCallsValue = 0;
  quadsValue = 0;
  circlesValue = 0;
  linesValue = 0;
  layersValue = 0;
  drawTimeValue = 0;
  elapsedValue = 0;
  peakFrameTime = 0;
  peakDrawCalls = 0;
  constructor(windowSize = 60) {
    this.windowSize = Math.max(1, windowSize);
  }
  /** Called once per rendered frame by the Engine. */
  recordFrame(frameTimeMs) {
    this.framesValue += 1;
    this.samples.push(frameTimeMs);
    if (this.samples.length > this.windowSize) this.samples.shift();
    if (frameTimeMs > this.peakFrameTime) this.peakFrameTime = frameTimeMs;
  }
  /** Called once per simulation step. */
  recordUpdateSteps(steps) {
    this.updateStepsValue += steps;
  }
  recordRender(stats) {
    this.drawCallsValue = stats.drawCalls;
    this.quadsValue = stats.quads;
    this.circlesValue = stats.circles;
    this.linesValue = stats.lines;
    this.layersValue = stats.layers;
    this.drawTimeValue = stats.drawTimeMs;
    if (stats.drawCalls > this.peakDrawCalls) this.peakDrawCalls = stats.drawCalls;
  }
  recordWorld(entities, elapsedSeconds) {
    this.entitiesValue = entities;
    this.elapsedValue = elapsedSeconds;
  }
  get averageFrameTimeMs() {
    if (this.samples.length === 0) return 0;
    let total = 0;
    for (const sample of this.samples) total += sample;
    return total / this.samples.length;
  }
  get fps() {
    const average = this.averageFrameTimeMs;
    return average > 0 ? 1e3 / average : 0;
  }
  snapshot() {
    return {
      frames: this.framesValue,
      fps: this.fps,
      frameTimeMs: this.averageFrameTimeMs,
      updateSteps: this.updateStepsValue,
      entities: this.entitiesValue,
      drawCalls: this.drawCallsValue,
      quads: this.quadsValue,
      circles: this.circlesValue,
      lines: this.linesValue,
      layers: this.layersValue,
      drawTimeMs: this.drawTimeValue,
      elapsedSeconds: this.elapsedValue,
      peakFrameTimeMs: this.peakFrameTime,
      peakDrawCalls: this.peakDrawCalls
    };
  }
  reset() {
    this.samples.length = 0;
    this.framesValue = 0;
    this.updateStepsValue = 0;
    this.drawCallsValue = 0;
    this.quadsValue = 0;
    this.circlesValue = 0;
    this.linesValue = 0;
    this.layersValue = 0;
    this.drawTimeValue = 0;
    this.peakFrameTime = 0;
    this.peakDrawCalls = 0;
  }
};

// engine/src/diagnostics/Profiler.ts
var Profiler = class {
  enabled;
  sections = /* @__PURE__ */ new Map();
  open = /* @__PURE__ */ new Map();
  windowSize;
  constructor(enabled = false, windowSize = 60) {
    this.enabled = enabled;
    this.windowSize = Math.max(1, windowSize);
  }
  sectionFor(name) {
    let section = this.sections.get(name);
    if (!section) {
      section = { name, start: 0, current: 0, peak: 0, total: 0, calls: 0, lastFrameSamples: [] };
      this.sections.set(name, section);
    }
    return section;
  }
  begin(name) {
    if (!this.enabled) return;
    const section = this.sectionFor(name);
    section.start = now2();
    this.open.set(name, (this.open.get(name) ?? 0) + 1);
    section.calls += 1;
  }
  end(name) {
    if (!this.enabled) return;
    const depth = this.open.get(name) ?? 0;
    if (depth === 0) return;
    if (depth === 1) this.open.delete(name);
    else this.open.set(name, depth - 1);
    const section = this.sectionFor(name);
    const elapsed = now2() - section.start;
    section.current += elapsed;
    if (section.current > section.peak) section.peak = section.current;
  }
  /** Time a function and return its result. */
  measure(name, fn) {
    if (!this.enabled) return fn();
    this.begin(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }
  /** Publish the current frame and start a new one. */
  endFrame() {
    if (!this.enabled) return;
    for (const section of this.sections.values()) {
      section.lastFrameSamples.push(section.current);
      if (section.lastFrameSamples.length > this.windowSize) section.lastFrameSamples.shift();
      section.total += section.current;
      section.current = 0;
    }
  }
  /** Section timings for the last frame. */
  report() {
    return Array.from(this.sections.values()).map((section) => {
      const samples = section.lastFrameSamples;
      const average = samples.length === 0 ? 0 : samples.reduce((a, b) => a + b, 0) / samples.length;
      return {
        name: section.name,
        lastMs: samples.length === 0 ? 0 : samples[samples.length - 1],
        averageMs: average,
        peakMs: section.peak,
        calls: section.calls
      };
    }).sort((a, b) => b.averageMs - a.averageMs);
  }
  /** The single hottest section, or null when nothing has been measured. */
  hottest() {
    const report = this.report();
    return report.length > 0 ? report[0] : null;
  }
  reset() {
    this.sections.clear();
    this.open.clear();
  }
};
function now2() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// engine/src/renderer/primitives/Circle.ts
function resolveColor(color) {
  if (typeof color === "string") return Color.fromHex(color);
  if (Array.isArray(color)) return Color.fromArray(color);
  return color?.clone() ?? Color.WHITE.clone();
}
function circle(options) {
  return {
    kind: "circle",
    x: options.x,
    y: options.y,
    radius: options.radius,
    color: resolveColor(options.color),
    filled: options.filled ?? true,
    lineWidth: options.lineWidth ?? 1,
    alpha: options.alpha ?? 1,
    layer: options.layer ?? 0,
    blend: options.blend ?? "normal"
  };
}

// engine/src/renderer/primitives/Line.ts
function resolveColor2(color) {
  if (typeof color === "string") return Color.fromHex(color);
  if (Array.isArray(color)) return Color.fromArray(color);
  return color?.clone() ?? Color.WHITE.clone();
}
function line(options) {
  return {
    kind: "line",
    x1: options.x1,
    y1: options.y1,
    x2: options.x2,
    y2: options.y2,
    color: resolveColor2(options.color),
    width: options.width ?? 1,
    alpha: options.alpha ?? 1,
    layer: options.layer ?? 0,
    blend: options.blend ?? "normal"
  };
}

// engine/src/diagnostics/DebugDraw.ts
var DebugDraw = class {
  enabled;
  color = Color.fromHex("#4ed6b8");
  lineWidth = 1;
  layer = 1e4;
  commands = [];
  constructor(enabled = false) {
    this.enabled = enabled;
  }
  get count() {
    return this.commands.length;
  }
  line(x1, y1, x2, y2, color) {
    if (!this.enabled) return;
    this.commands.push(line({ x1, y1, x2, y2, color: color ?? this.color, width: this.lineWidth, layer: this.layer }));
  }
  rect(bounds, color) {
    if (!this.enabled) return;
    const c = color ?? this.color;
    this.line(bounds.left, bounds.top, bounds.right, bounds.top, c);
    this.line(bounds.right, bounds.top, bounds.right, bounds.bottom, c);
    this.line(bounds.right, bounds.bottom, bounds.left, bounds.bottom, c);
    this.line(bounds.left, bounds.bottom, bounds.left, bounds.top, c);
  }
  circle(x, y, radius, color) {
    if (!this.enabled) return;
    this.commands.push(circle({
      x,
      y,
      radius,
      color: color ?? this.color,
      filled: false,
      lineWidth: this.lineWidth,
      layer: this.layer
    }));
  }
  /** Crosshair marker at a point. */
  cross(x, y, size = 4, color) {
    if (!this.enabled) return;
    const c = color ?? this.color;
    this.line(x - size, y, x + size, y, c);
    this.line(x, y - size, x, y + size, c);
  }
  /** Label a point with its entity id - handy when inspecting a live scene. */
  entityMarker(id, x, y, size = 6) {
    if (!this.enabled) return;
    this.cross(x, y, size);
    this.circle(x, y, size, Color.fromHex("#b78cff"));
    void id;
  }
  /** Hand collected commands to the render queue. Called once per render frame. */
  flushTo(queue) {
    if (this.commands.length === 0) return 0;
    const flushed = this.commands.length;
    for (const command of this.commands) queue.add(command);
    this.commands.length = 0;
    return flushed;
  }
  clear() {
    this.commands.length = 0;
  }
};

// engine/src/platform/Platform.ts
function detectPlatformKind() {
  if (typeof window === "undefined") return "headless";
  const maybeElectron = window;
  if (maybeElectron.gameforge || maybeElectron.process?.versions?.electron) {
    return "electron";
  }
  return "browser";
}

// engine/src/platform/BrowserPlatform.ts
var BrowserPlatform = class {
  /** Held in a field with a getter so subclasses can refine it without re-declaring the member. */
  infoValue;
  frameHandles = /* @__PURE__ */ new Map();
  nextHandle = 1;
  constructor(kind = detectPlatformKind()) {
    const nav = typeof navigator !== "undefined" ? navigator : void 0;
    this.infoValue = {
      kind,
      userAgent: nav?.userAgent ?? "unknown",
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1,
      isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent ?? ""),
      locale: nav?.language ?? "en",
      cores: nav?.hardwareConcurrency ?? 1
    };
  }
  get info() {
    return this.infoValue;
  }
  get isHeadless() {
    return false;
  }
  now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }
  requestFrame(callback) {
    const handle = this.nextHandle++;
    if (typeof requestAnimationFrame === "function") {
      const rafId = requestAnimationFrame((time) => {
        this.frameHandles.delete(handle);
        callback(time);
      });
      this.frameHandles.set(handle, rafId);
      return handle;
    }
    const timeoutId = setTimeout(() => {
      this.frameHandles.delete(handle);
      callback(this.now());
    }, 16);
    this.frameHandles.set(handle, timeoutId);
    return handle;
  }
  cancelFrame(handle) {
    const id = this.frameHandles.get(handle);
    if (id === void 0) return;
    this.frameHandles.delete(handle);
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
    else clearTimeout(id);
  }
  createCanvas(width, height) {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
};
var HeadlessPlatform = class {
  info = {
    kind: "headless",
    userAgent: "gameforge-headless",
    devicePixelRatio: 1,
    isMobile: false,
    locale: "en",
    cores: 1
  };
  currentTime = 0;
  pending = /* @__PURE__ */ new Map();
  nextHandle = 1;
  get isHeadless() {
    return true;
  }
  now() {
    return this.currentTime;
  }
  /** Advance the virtual clock by `ms`. Does not run scheduled callbacks. */
  advanceTime(ms) {
    this.currentTime += ms;
  }
  requestFrame(callback) {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }
  cancelFrame(handle) {
    this.pending.delete(handle);
  }
  /** Run each pending frame callback once, advancing the virtual clock by `ms`. */
  advanceFrame(ms = 16) {
    this.advanceTime(ms);
    const callbacks = Array.from(this.pending.values());
    this.pending.clear();
    for (const callback of callbacks) callback(this.currentTime);
  }
  createCanvas() {
    return null;
  }
};

// engine/src/platform/ElectronPlatform.ts
var ElectronPlatform = class extends BrowserPlatform {
  reporter;
  constructor(reporter) {
    super("electron");
    this.reporter = reporter ?? globalThis.gameforge ?? null;
  }
  /** Forward a status update to the shell. No-op when no bridge is present. */
  reportState(state) {
    this.reporter?.reportRuntimeState?.(state);
  }
  reportLog(level, message) {
    this.reporter?.log?.(level, message);
  }
  get hasBridge() {
    return this.reporter !== null;
  }
};

// engine/src/core/Engine.ts
var Engine = class _Engine {
  config;
  world;
  renderer;
  input = new Input();
  assets;
  logger;
  metrics = new Metrics();
  profiler;
  debugDraw;
  platform;
  loop;
  events;
  game;
  renderSystem = null;
  transformSystem = null;
  scriptSystem = null;
  inputSystem = null;
  startedValue = false;
  readyValue = false;
  startedAt = 0;
  lastRenderAt = 0;
  constructor(config = {}, options = {}) {
    this.config = resolveEngineConfig(config);
    this.logger = options.logger ?? new Logger({
      level: this.config.debug ? "debug" : "info",
      scope: "engine",
      // Headless runs (tests, CI) should stay quiet unless something is wrong.
      mirrorToConsole: !this.config.headless
    });
    this.profiler = new Profiler(this.config.debug);
    this.debugDraw = new DebugDraw(this.config.debug);
    this.events = options.events ?? new EventBus();
    this.platform = options.platform ?? _Engine.createPlatform(options.logger);
    this.world = new World({ events: this.events, onError: (error, context) => this.logger.error(context, error) });
    this.renderer = options.renderer ?? _Engine.createRenderer(this.config, this.platform);
    this.assets = new AssetManager({
      events: this.events,
      logger: this.logger.child("assets"),
      fetchImpl: typeof fetch === "function" ? fetch : void 0
    });
    this.game = options.game ?? null;
    Object.assign(this.world.services, {
      renderer: this.renderer,
      input: this.input,
      assets: this.assets,
      logger: this.logger,
      platform: this.platform,
      engine: this,
      metrics: this.metrics,
      profiler: this.profiler,
      debugDraw: this.debugDraw
    });
    this.loop = new GameLoop(
      {
        fixedTimeStep: this.config.fixedTimeStep,
        maxDeltaTime: this.config.maxDeltaTime,
        schedule: (callback) => this.platform.requestFrame(() => callback()),
        cancel: (handle) => this.platform.cancelFrame(handle)
      },
      {
        update: (delta) => this.update(delta),
        render: (alpha) => this.render(alpha)
      }
    );
    if (options.registerDefaultSystems !== false) this.registerDefaultSystems();
  }
  /** Pick a platform: Electron when the shell bridge is present, else browser or headless. */
  static createPlatform(logger) {
    const kind = detectPlatformKind();
    if (kind === "electron") return new ElectronPlatform();
    if (kind === "browser") return new BrowserPlatform("browser");
    logger?.debug("no DOM detected - using the headless platform");
    return new HeadlessPlatform();
  }
  /**
   * Pick a renderer. Canvas2D is the shipped backend; requesting WebGL2 before milestone 2 lands
   * fails loudly rather than silently degrading, because a silent fallback hides missing work.
   */
  static createRenderer(config, platform) {
    if (config.headless) return new Canvas2DRenderer(null);
    if (config.renderer === "webgl2") {
      throw new Error(
        'WebGL2 renderer is not implemented yet (milestone 2). Use renderer: "auto" or "canvas2d".'
      );
    }
    const canvas = config.canvas ?? platform.createCanvas?.(config.width, config.height) ?? null;
    if (!canvas) throw new Error("No canvas available: pass EngineConfig.canvas or enable headless mode");
    return new Canvas2DRenderer(canvas);
  }
  registerDefaultSystems() {
    this.inputSystem = new InputSystem();
    this.transformSystem = new TransformSystem();
    this.scriptSystem = new ScriptSystem({ onError: (error, context) => this.logger.error(context, error) });
    this.renderSystem = new RenderSystem({ renderer: this.renderer, clearColor: "#0b1020", cull: true });
    this.world.addSystem(this.inputSystem).addSystem(this.transformSystem).addSystem(this.scriptSystem).addSystem(this.renderSystem);
  }
  /* ------------------------------------------------------------------ lifecycle */
  get isStarted() {
    return this.startedValue;
  }
  get isReady() {
    return this.readyValue;
  }
  get gameRef() {
    return this.game;
  }
  get backend() {
    return this.renderer.backend;
  }
  /** Initialise the backend, attach input, run the game's setup, then begin the loop. */
  async start(game) {
    if (this.startedValue) return;
    if (game) this.game = game;
    await this.renderer.initialize();
    this.renderer.resize(this.config.width, this.config.height, this.config.pixelRatio);
    if (!this.config.headless) {
      this.input.attach({
        element: this.config.canvas,
        pointerTarget: this.config.canvas ?? void 0,
        preventDefault: true
      });
    }
    this.readyValue = true;
    this.events.emit("engine:ready", {
      backend: this.renderer.backend,
      width: this.renderer.width,
      height: this.renderer.height
    });
    if (this.game) {
      try {
        await this.game.setup(this);
      } catch (error) {
        this.events.emit("engine:error", { error, phase: "setup" });
        throw error;
      }
    }
    if (this.config.headless) {
      this.startedValue = true;
      this.startedAt = this.platform.now();
      this.events.emit("engine:started", { startedAt: this.startedAt });
      return;
    }
    this.loop.start();
    this.startedValue = true;
    this.startedAt = this.platform.now();
    this.events.emit("engine:started", { startedAt: this.startedAt });
    this.logger.info(`engine started (${this.renderer.backend} ${this.renderer.width}x${this.renderer.height})`);
  }
  /** Stop the loop and release the game's resources. The engine can be started again. */
  async stop() {
    if (!this.startedValue) return;
    this.loop.stop();
    this.input.detach();
    if (this.game?.teardown) {
      try {
        await this.game.teardown(this);
      } catch (error) {
        this.logger.error("error in game teardown", error);
      }
    }
    this.startedValue = false;
    this.events.emit("engine:stopped", { frames: this.loop.stats.frames, elapsed: this.loop.clock.elapsed });
  }
  pause() {
    this.loop.pause();
    this.events.emit("engine:paused", { elapsed: this.loop.clock.elapsed });
  }
  resume() {
    this.loop.resume();
    this.events.emit("engine:resumed", { elapsed: this.loop.clock.elapsed });
  }
  get isPaused() {
    return this.loop.isPaused;
  }
  /* ------------------------------------------------------------------ stepping */
  /** One fixed simulation step: systems run, then input edges are cleared. */
  update(deltaSeconds) {
    this.profiler.begin("update");
    try {
      this.world.update(deltaSeconds);
      this.input.endFrame();
      this.metrics.recordWorld(this.world.entityCount, this.loop.clock.elapsed);
    } finally {
      this.profiler.end("update");
    }
  }
  /** One presentation step. */
  render(alpha) {
    const frameStart = this.platform.now();
    this.metrics.recordFrame(this.lastRenderAt > 0 ? frameStart - this.lastRenderAt : 0);
    this.lastRenderAt = frameStart;
    this.profiler.begin("render");
    try {
      this.world.render(alpha);
      this.profiler.end("render");
      this.profiler.endFrame();
    } catch (error) {
      this.profiler.end("render");
      this.profiler.endFrame();
      this.events.emit("engine:error", { error, phase: "render" });
      this.logger.error("render failed", error);
    }
  }
  /**
   * Run an exact number of fixed steps without a scheduler - the deterministic entry point used by
   * tests and the headless smoke test. Optionally renders once at the end.
   */
  advance(steps, options = {}) {
    for (let i = 0; i < steps; i += 1) {
      this.loop.clock.step(this.config.fixedTimeStep);
      this.update(this.config.fixedTimeStep);
    }
    if (options.render ?? !this.config.headless) this.render(0);
  }
  resize(width, height, pixelRatio = this.config.pixelRatio) {
    this.renderer.resize(width, height, pixelRatio);
    this.events.emit("engine:resized", { width, height, pixelRatio });
  }
  /* ------------------------------------------------------------------ diagnostics */
  get metricsSnapshot() {
    return this.metrics.snapshot();
  }
  get uptimeSeconds() {
    return this.startedValue ? (this.platform.now() - this.startedAt) / 1e3 : 0;
  }
  /** Current state as a plain object: the portal's runtime panel and the Electron shell read this. */
  runtimeState() {
    const metrics = this.metrics.snapshot();
    return {
      backend: this.renderer.backend,
      width: this.renderer.width,
      height: this.renderer.height,
      pixelRatio: this.renderer.pixelRatio,
      fps: Math.round(metrics.fps * 10) / 10,
      frameTimeMs: Math.round(metrics.frameTimeMs * 100) / 100,
      frames: metrics.frames,
      entities: this.world.entityCount,
      activeScene: this.world.activeScene?.name ?? null,
      scenes: this.world.sceneNames,
      drawCalls: metrics.drawCalls,
      assets: this.assets.stats,
      uptimeSeconds: Math.round(this.uptimeSeconds * 10) / 10,
      paused: this.isPaused
    };
  }
  /** Push state to the host shell when one is attached (Electron). Otherwise a no-op. */
  reportRuntimeState() {
    if (this.platform instanceof ElectronPlatform) this.platform.reportState(this.runtimeState());
  }
  dispose() {
    this.loop.stop();
    this.input.detach();
    this.world.dispose();
    this.renderer.dispose();
    this.assets.clear();
    this.events.clear();
    this.readyValue = false;
    this.startedValue = false;
  }
};

// engine/src/core/Game.ts
function isGame(value) {
  return typeof value === "object" && value !== null && typeof value.setup === "function";
}

// engine/src/display/DisplayAdapter.ts
function clampPixelRatio(value, max) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(value, Math.max(1, max));
}
var BrowserDisplayAdapter = class {
  constructor(options) {
    this.options = options;
  }
  options;
  kind = "browser-canvas";
  observer = null;
  windowResizeListener = null;
  attach(engine) {
    const sync = () => {
      const pixelRatio = clampPixelRatio(
        typeof window === "undefined" ? 1 : window.devicePixelRatio,
        this.options.maxPixelRatio ?? 2
      );
      engine.resize(this.options.logicalWidth, this.options.logicalHeight, pixelRatio);
    };
    this.windowResizeListener = sync;
    if (typeof window !== "undefined") window.addEventListener("resize", sync, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(sync);
      this.observer.observe(this.options.stage ?? this.options.canvas);
    }
    sync();
  }
  async requestFullscreen() {
    const target = this.options.stage ?? this.options.canvas;
    if (typeof document !== "undefined" && document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (target.requestFullscreen) await target.requestFullscreen();
  }
  dispose() {
    if (this.windowResizeListener && typeof window !== "undefined") {
      window.removeEventListener("resize", this.windowResizeListener);
    }
    this.observer?.disconnect();
    this.observer = null;
    this.windowResizeListener = null;
  }
};

export {
  Vector2,
  Transform,
  Color,
  Sprite,
  Engine,
  Scene,
  isGame,
  rect,
  BrowserDisplayAdapter
};
//# sourceMappingURL=chunk-H2D4S5XG.js.map
