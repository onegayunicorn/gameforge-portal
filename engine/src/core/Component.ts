/**
 * Components are plain data attached to an entity. They carry no behaviour: systems own the
 * behaviour, which is what keeps gameplay logic testable and composable.
 */
export interface Component {}

/**
 * Optional lifecycle hooks, kept separate from the `Component` marker on purpose.
 *
 * An interface whose members are all optional is a "weak type" in TypeScript, and a class with no
 * overlapping members then fails to satisfy it. Making `Component` an empty marker - and reading
 * the hooks through `componentHooks()` - keeps `implements Component` valid for plain data classes
 * while still supporting lifecycle callbacks.
 */
export interface ComponentHooks {
  onAttach?(): void;
  onDetach?(): void;
}

/** View a component through its optional lifecycle hooks. */
export function componentHooks(component: Component): ComponentHooks {
  return component as ComponentHooks;
}

/**
 * A component constructor used as the runtime key in the component store.
 *
 * Declared with `abstract new` so an abstract base such as `Script` can itself be a storage key -
 * concrete classes remain assignable to it.
 */
export type ComponentClass<T extends Component = Component> = abstract new (...args: never[]) => T;

/**
 * Stable name for a component type.
 *
 * Minified builds mangle `Function.name`, so a `componentName` static is honoured first and the
 * constructor name is only a fallback. Scene files reference components by this name.
 */
export function componentTypeName(type: ComponentClass): string {
  const named = (type as unknown as { componentName?: string }).componentName;
  return named ?? type.name ?? 'AnonymousComponent';
}

/** Marker interface documenting the expected static on a component class. */
export interface NamedComponentClass<T extends Component = Component> {
  readonly componentName: string;
  new (...args: never[]): T;
}
