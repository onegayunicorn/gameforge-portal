import { componentTypeName } from '../core/Component';
import type { Script } from './Script';

/**
 * Safe invocation of script lifecycle hooks.
 *
 * A throwing script must never take down the frame, and the failure must be attributable: these
 * helpers isolate each error, report it with the script's type name and leave the rest of the
 * frame running. They are shared by ScriptSystem, SceneLoader and the editor's play mode so the
 * behaviour is identical everywhere.
 */
export type LifecycleErrorHandler = (error: unknown, context: string, script: Script) => void;

export interface LifecycleOptions {
  onError?: LifecycleErrorHandler;
  /** Log a debug line for every hook call. Very noisy; development only. */
  trace?: boolean;
}

export function scriptLabel(script: Script): string {
  const type = script.constructor as { name?: string; componentName?: string };
  return componentTypeName(type as never) || 'Script';
}

export function invokeOnStart(script: Script, options: LifecycleOptions = {}): boolean {
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

export function invokeOnUpdate(script: Script, deltaSeconds: number, options: LifecycleOptions = {}): boolean {
  if (script.isDestroyed || !script.hasStarted) return false;
  try {
    script.onUpdate(deltaSeconds);
    return true;
  } catch (error) {
    options.onError?.(error, `${scriptLabel(script)}#${script.entity}.onUpdate`, script);
    return false;
  }
}

export function invokeOnDestroy(script: Script, options: LifecycleOptions = {}): boolean {
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

export function invokeOnEnabledChanged(script: Script, enabled: boolean, options: LifecycleOptions = {}): void {
  try {
    script.onEnabledChanged(enabled);
  } catch (error) {
    options.onError?.(error, `${scriptLabel(script)}#${script.entity}.onEnabledChanged`, script);
  }
}
