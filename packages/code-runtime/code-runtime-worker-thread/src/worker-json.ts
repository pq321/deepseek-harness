/**
 * Lossless-JSON snapshots for the dependency-free source worker closure.
 * @module @deepseek-ai/dsh-code-runtime-worker-thread/worker-json
 */

import type { CodeJsonValue } from '@deepseek-ai/dsh-code-runtime'

/* jscpd:ignore-start -- the source worker mirrors session JSON helpers without workspace runtime imports */
type IntrinsicCallable = (this: unknown, ...args: unknown[]) => unknown

const intrinsicFunctionToString = Reflect.get(Function.prototype, 'toString') as IntrinsicCallable
const intrinsicReflectApply = Reflect.get(Reflect, 'apply') as (
  target: IntrinsicCallable,
  thisArgument: unknown,
  argumentsList: readonly unknown[],
) => unknown
const IntrinsicError = Error
const IntrinsicSet = Set
const IntrinsicString = String
const intrinsicArrayIsArray = Array.isArray
const intrinsicArrayPrototype = Array.prototype
const intrinsicNumberIsFinite = Number.isFinite
const intrinsicNumberIsSafeInteger = Number.isSafeInteger
const intrinsicObjectCreate = Object.create
const intrinsicObjectDefineProperty = Object.defineProperty
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf
const intrinsicObjectHasOwn = Object.hasOwn
const intrinsicObjectIs = Object.is
const intrinsicObjectKeys = Object.keys
const intrinsicObjectPrototype = Object.prototype
const intrinsicObjectPropertyIsEnumerable = Reflect.get(intrinsicObjectPrototype, 'propertyIsEnumerable') as IntrinsicCallable
const intrinsicReflectOwnKeys = Reflect.ownKeys
const intrinsicSetAdd = Reflect.get(Set.prototype, 'add') as IntrinsicCallable
const intrinsicSetDelete = Reflect.get(Set.prototype, 'delete') as IntrinsicCallable
const intrinsicSetHas = Reflect.get(Set.prototype, 'has') as IntrinsicCallable

/** Build a data descriptor that cannot inherit model-defined accessor fields. */
function dataDescriptor(value: unknown): PropertyDescriptor {
  const descriptor = intrinsicObjectCreate(null) as PropertyDescriptor
  descriptor.value = value
  return descriptor
}

/** Define an ordinary enumerable data slot without a prototype-bearing descriptor. */
function defineEnumerableDataProperty(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = dataDescriptor(value)
  descriptor.enumerable = true
  descriptor.configurable = true
  descriptor.writable = true
  intrinsicObjectDefineProperty(target, key, descriptor)
}

/** Append without consulting a model-mutated `Array.prototype`. */
function append<T>(target: T[], value: T): void {
  defineEnumerableDataProperty(target, target.length, value)
}

/** Pop without consulting a model-mutated `Array.prototype`. */
function takeLast<T>(target: T[]): T | undefined {
  if (target.length === 0) return undefined
  const index = target.length - 1
  const value = target[index]
  intrinsicObjectDefineProperty(target, 'length', dataDescriptor(index))
  return value
}

/** Whether one captured-intrinsic Set contains a value. */
function setHas<T>(target: Set<T>, value: T): boolean {
  return intrinsicReflectApply(intrinsicSetHas, target, [value]) as boolean
}

/** Add to one captured-intrinsic Set. */
function setAdd<T>(target: Set<T>, value: T): void {
  intrinsicReflectApply(intrinsicSetAdd, target, [value])
}

/** Delete from one captured-intrinsic Set. */
function setDelete<T>(target: Set<T>, value: T): void {
  intrinsicReflectApply(intrinsicSetDelete, target, [value])
}

/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor(prototype: object, name: 'Array' | 'Object'): boolean {
  const descriptor = intrinsicObjectGetOwnPropertyDescriptor(prototype, 'constructor')
  const constructor: unknown = descriptor?.value
  if (typeof constructor !== 'function') return false
  try {
    return constructor.name === name
      && constructor.prototype === prototype
      && intrinsicReflectApply(intrinsicFunctionToString, constructor, []) === `function ${name}() { [native code] }`
  } catch {
    return false
  }
}

/** Whether a candidate is a foreign realm's intrinsic `Object.prototype`. */
function isForeignIntrinsicObjectPrototype(value: object): boolean {
  return intrinsicObjectGetPrototypeOf(value) === null && hasIntrinsicConstructor(value, 'Object')
}

/** Whether an array uses one realm's intrinsic `Array.prototype`, not a subclass or forged prototype. */
function hasPlainArrayPrototype(value: unknown[]): boolean {
  const prototype: unknown = intrinsicObjectGetPrototypeOf(value)
  if (prototype === intrinsicArrayPrototype) return true
  if (!intrinsicArrayIsArray(prototype) || !hasIntrinsicConstructor(prototype, 'Array')) return false
  const objectPrototype: unknown = intrinsicObjectGetPrototypeOf(prototype)
  return typeof objectPrototype === 'object'
    && objectPrototype !== null
    && isForeignIntrinsicObjectPrototype(objectPrototype)
}

/** Whether an object is a plain or null-prototype record from any JavaScript realm. */
function hasPlainObjectPrototype(value: object): boolean {
  const prototype: unknown = intrinsicObjectGetPrototypeOf(value)
  return prototype === null
    || prototype === intrinsicObjectPrototype
    || typeof prototype === 'object' && isForeignIntrinsicObjectPrototype(prototype)
}

/** Return every JSON-visible object key, or reject own data JSON would discard. */
function enumerableStringKeys(value: object): string[] | undefined {
  const keys = intrinsicReflectOwnKeys(value)
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    if (typeof key !== 'string' || !intrinsicReflectApply(intrinsicObjectPropertyIsEnumerable, value, [key])) return undefined
  }
  return keys as string[]
}

type SnapshotDestination =
  | { kind: 'root' }
  | { kind: 'array'; target: CodeJsonValue[]; index: number }
  | { kind: 'object'; target: Record<string, CodeJsonValue>; key: string }

/** One linked segment in the first invalid completion value's JSON path. */
export interface CodeJsonPath {
  readonly parent?: CodeJsonPath
  readonly segment?: string | number
}

/** Why a completion value could not be represented as lossless JSON. */
export interface CodeJsonFailure {
  readonly path: CodeJsonPath
  readonly reason: string
  readonly cause?: unknown
}

/** A detached JSON snapshot or the first value that violates lossless JSON. */
export type CodeJsonSnapshot =
  | { readonly ok: true; readonly value: CodeJsonValue }
  | { readonly ok: false; readonly failure: CodeJsonFailure }

type SnapshotTask =
  | { kind: 'visit'; value: unknown; destination: SnapshotDestination; path: CodeJsonPath }
  | { kind: 'array-item'; source: unknown[]; index: number; target: CodeJsonValue[]; path: CodeJsonPath }
  | { kind: 'object-property'; source: Record<string, unknown>; key: string; target: Record<string, CodeJsonValue>; path: CodeJsonPath }
  | { kind: 'leave'; source: object }

/** Create one validation failure without consulting model-owned values. */
function invalidSnapshot(path: CodeJsonPath, reason: string): CodeJsonSnapshot {
  return { ok: false, failure: { path, reason } }
}

/**
 * Validate and detach one worker-boundary value while retaining the first
 * lossless-JSON violation for a model-actionable completion diagnostic.
 * Traversal and paths are iterative/linked, so nesting does not consume the
 * JavaScript call stack or duplicate full path strings at every level.
 *
 * @param value - the candidate completion value.
 * @returns the detached snapshot or the first invalid path and reason.
 */
export function snapshotCodeJsonValueWithDiagnostic(value: unknown): CodeJsonSnapshot {
  const active = new IntrinsicSet<object>()
  const rootPath: CodeJsonPath = {}
  let root: CodeJsonValue | undefined
  let currentPath = rootPath
  const assign = (destination: SnapshotDestination, item: CodeJsonValue): void => {
    if (destination.kind === 'root') {
      root = item
    } else if (destination.kind === 'array') {
      defineEnumerableDataProperty(destination.target, destination.index, item)
    } else {
      defineEnumerableDataProperty(destination.target, destination.key, item)
    }
  }

  const tasks: SnapshotTask[] = [{ kind: 'visit', value, destination: { kind: 'root' }, path: rootPath }]
  try {
    for (let task = takeLast(tasks); task !== undefined; task = takeLast(tasks)) {
      if (task.kind === 'leave') {
        setDelete(active, task.source)
        continue
      }
      currentPath = task.path
      if (task.kind === 'array-item') {
        if (!intrinsicObjectHasOwn(task.source, task.index)) {
          return invalidSnapshot(task.path, 'is a missing array element; fill it or use null')
        }
        append(tasks, {
          kind: 'visit',
          value: task.source[task.index],
          destination: { kind: 'array', target: task.target, index: task.index },
          path: task.path,
        })
        continue
      }
      if (task.kind === 'object-property') {
        append(tasks, {
          kind: 'visit',
          value: task.source[task.key],
          destination: { kind: 'object', target: task.target, key: task.key },
          path: task.path,
        })
        continue
      }

      const candidate = task.value
      if (candidate === null) {
        assign(task.destination, null)
        continue
      }
      if (typeof candidate === 'boolean' || typeof candidate === 'string') {
        assign(task.destination, candidate)
        continue
      }
      if (typeof candidate === 'number') {
        if (!intrinsicNumberIsFinite(candidate)) {
          return invalidSnapshot(task.path, `is ${IntrinsicString(candidate)}; use a finite number or null`)
        }
        if (intrinsicObjectIs(candidate, -0)) return invalidSnapshot(task.path, 'is negative zero; use 0')
        assign(task.destination, candidate)
        continue
      }
      if (candidate === undefined) return invalidSnapshot(task.path, 'is undefined; omit the property or use null')
      if (typeof candidate === 'bigint') return invalidSnapshot(task.path, 'is a bigint; convert it to a number or string')
      if (typeof candidate === 'function') return invalidSnapshot(task.path, 'is a function; return JSON data instead')
      if (typeof candidate === 'symbol') return invalidSnapshot(task.path, 'is a symbol; convert it to a string or omit it')
      if (typeof candidate !== 'object') return invalidSnapshot(task.path, 'is not a JSON value')
      if (setHas(active, candidate)) return invalidSnapshot(task.path, 'creates a cycle; return a tree of JSON values')

      if (intrinsicArrayIsArray(candidate)) {
        if (!hasPlainArrayPrototype(candidate)) {
          return invalidSnapshot(task.path, 'uses a non-plain array prototype; return a plain array')
        }
        const length = candidate.length
        const ownKeys = intrinsicReflectOwnKeys(candidate)
        for (let index = 0; index < length; index++) {
          if (!intrinsicObjectHasOwn(candidate, index)) {
            return invalidSnapshot({ parent: task.path, segment: index }, 'is a missing array element; fill it or use null')
          }
        }
        if (ownKeys.length !== length + 1) {
          return invalidSnapshot(task.path, 'has non-index properties; return a dense array without extra properties')
        }
        const target: CodeJsonValue[] = []
        assign(task.destination, target)
        setAdd(active, candidate)
        append(tasks, { kind: 'leave', source: candidate })
        for (let index = length - 1; index >= 0; index--) {
          append(tasks, {
            kind: 'array-item',
            source: candidate,
            index,
            target,
            path: { parent: task.path, segment: index },
          })
        }
        continue
      }

      if (!hasPlainObjectPrototype(candidate)) {
        return invalidSnapshot(task.path, 'uses a non-plain object prototype; return a plain object')
      }
      const ownKeys = intrinsicReflectOwnKeys(candidate)
      const keys: string[] = []
      for (let index = 0; index < ownKeys.length; index++) {
        const key = ownKeys[index]
        if (typeof key !== 'string' || !intrinsicReflectApply(intrinsicObjectPropertyIsEnumerable, candidate, [key])) {
          return invalidSnapshot(task.path, 'has symbol or non-enumerable properties; return an object with enumerable string keys only')
        }
        append(keys, key)
      }
      const target: Record<string, CodeJsonValue> = {}
      assign(task.destination, target)
      setAdd(active, candidate)
      append(tasks, { kind: 'leave', source: candidate })
      for (let index = keys.length - 1; index >= 0; index--) {
        const key = keys[index]
        /* v8 ignore next -- the loop is bounded by the captured key count. */
        if (key === undefined) return invalidSnapshot(task.path, 'has an unreadable object key')
        append(tasks, {
          kind: 'object-property',
          source: candidate as Record<string, unknown>,
          key,
          target,
          path: { parent: task.path, segment: key },
        })
      }
    }
  } catch (cause: unknown) {
    return { ok: false, failure: { path: currentPath, reason: 'could not be read; return stable JSON data properties', cause } }
  }
  /* v8 ignore next -- every valid root assigns exactly once. */
  return root === undefined
    ? invalidSnapshot(rootPath, 'is undefined; return a JSON value')
    : { ok: true, value: root }
}

/**
 * Validate and detach one worker-boundary value without loading another
 * workspace package at runtime. This mirrors the session-owned canonical
 * JSON boundary while remaining safe to import from the unbuilt worker.
 * Its iterative traversal adds no JavaScript call-stack depth limit.
 *
 * @param value - the candidate completion value.
 * @returns a detached lossless-JSON snapshot, or `undefined` when invalid.
 */
export function snapshotCodeJsonValue(value: unknown): CodeJsonValue | undefined {
  const result = snapshotCodeJsonValueWithDiagnostic(value)
  if (result.ok) return result.value
  if ('cause' in result.failure) throw result.failure.cause
  return undefined
}

interface ArrayWireToken {
  kind: 'array'
  length: number
}

interface ObjectWireToken {
  kind: 'object'
  keys: string[]
}

type WorkerJsonToken = null | boolean | number | string | ArrayWireToken | ObjectWireToken

/**
 * A pre-order, bounded-depth transport for one lossless JSON value. Container
 * markers and scalar leaves share one flat token array, so `worker_threads`
 * never has to structured-clone the value's application nesting.
 */
export type WorkerJsonWire = WorkerJsonToken[]

/**
 * Flatten one validated JSON value for the worker-thread message port.
 * @param value - the lossless JSON value to transport.
 * @returns a pre-order token stream whose own nesting is bounded.
 */
export function encodeWorkerJson(value: CodeJsonValue): WorkerJsonWire {
  const wire: WorkerJsonWire = []
  const pending: CodeJsonValue[] = [value]
  for (let current = takeLast(pending); current !== undefined; current = takeLast(pending)) {
    if (current === null || typeof current === 'boolean' || typeof current === 'number' || typeof current === 'string') {
      append(wire, current)
      continue
    }
    if (intrinsicArrayIsArray(current)) {
      append(wire, { kind: 'array', length: current.length })
      for (let index = current.length - 1; index >= 0; index--) {
        const item = current[index]
        if (item === undefined) throw new IntrinsicError('cannot encode a sparse JSON array')
        append(pending, item)
      }
      continue
    }
    const keys = intrinsicObjectKeys(current)
    append(wire, { kind: 'object', keys })
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index]
      /* v8 ignore next -- the loop is bounded by the captured key count. */
      if (key === undefined) throw new IntrinsicError('cannot encode a missing JSON object key')
      const item = current[key]
      if (item === undefined) throw new IntrinsicError('cannot encode an undefined JSON object property')
      append(pending, item)
    }
  }
  return wire
}

type DecodeFrame =
  | { kind: 'array'; target: CodeJsonValue[]; length: number; index: number }
  | { kind: 'object'; target: Record<string, CodeJsonValue>; keys: string[]; index: number }

/** Whether an array contains exactly its dense indexed slots and `length`. */
function isDenseArray(value: unknown[]): boolean {
  if (!hasPlainArrayPrototype(value) || intrinsicReflectOwnKeys(value).length !== value.length + 1) return false
  for (let index = 0; index < value.length; index++) {
    if (!intrinsicObjectHasOwn(value, index)) return false
  }
  return true
}

/** Whether one exact string-key list contains a key, without consulting its prototype. */
function keysContain(keys: string[], expected: string): boolean {
  for (let index = 0; index < keys.length; index++) {
    if (keys[index] === expected) return true
  }
  return false
}

/** Return one exact container marker, or reject any extra/missing fields. */
function containerToken(value: object): ArrayWireToken | ObjectWireToken | undefined {
  if (intrinsicArrayIsArray(value) || !hasPlainObjectPrototype(value)) return undefined
  const keys = enumerableStringKeys(value)
  if (keys === undefined) return undefined
  const token = value as Record<string, unknown>
  if (token.kind === 'array') {
    if (keys.length !== 2 || !keysContain(keys, 'kind') || !keysContain(keys, 'length')) return undefined
    const length = token.length
    return typeof length === 'number' && intrinsicNumberIsSafeInteger(length) && length >= 0
      ? { kind: 'array', length }
      : undefined
  }
  if (token.kind === 'object') {
    if (keys.length !== 2 || !keysContain(keys, 'kind') || !keysContain(keys, 'keys')) return undefined
    const objectKeys = token.keys
    if (!intrinsicArrayIsArray(objectKeys) || !isDenseArray(objectKeys)) return undefined
    const unique = new IntrinsicSet<string>()
    const normalizedKeys: string[] = []
    const objectKeyValues = objectKeys as unknown[]
    for (let index = 0; index < objectKeyValues.length; index++) {
      const key = objectKeyValues[index]
      if (typeof key !== 'string' || setHas(unique, key)) return undefined
      setAdd(unique, key)
      append(normalizedKeys, key)
    }
    return { kind: 'object', keys: normalizedKeys }
  }
  return undefined
}

/**
 * Rebuild one lossless JSON value from the flat worker-thread wire format.
 * Malformed or incomplete traffic returns `undefined`; traversal is iterative
 * and therefore independent of the transported value's application depth.
 * @param input - untrusted message-port payload.
 * @returns the detached JSON value, or `undefined` when the wire is invalid.
 */
export function decodeWorkerJson(input: unknown): CodeJsonValue | undefined {
  try {
    if (!intrinsicArrayIsArray(input) || !isDenseArray(input) || input.length === 0) return undefined
    const wire = input as unknown[]
    const frames: DecodeFrame[] = []
    let root: CodeJsonValue | undefined
    let rootAssigned = false

    const attach = (value: CodeJsonValue): boolean => {
      const parent = frames[frames.length - 1]
      if (!parent) {
        if (rootAssigned) return false
        root = value
        rootAssigned = true
        return true
      }
      /* v8 ignore next -- completed frames are popped before another token can attach. */
      if (parent.index >= (parent.kind === 'array' ? parent.length : parent.keys.length)) return false
      if (parent.kind === 'array') {
        append(parent.target, value)
      } else {
        const key = parent.keys[parent.index]
        /* v8 ignore next -- object frames are built from validated keys and their exact length. */
        if (key === undefined) return false
        defineEnumerableDataProperty(parent.target, key, value)
      }
      parent.index += 1
      return true
    }

    for (let tokenIndex = 0; tokenIndex < wire.length; tokenIndex++) {
      const token = wire[tokenIndex]
      let value: CodeJsonValue
      let frame: DecodeFrame | undefined
      if (token === null || typeof token === 'boolean' || typeof token === 'string') {
        value = token
      } else if (typeof token === 'number') {
        if (!intrinsicNumberIsFinite(token) || intrinsicObjectIs(token, -0)) return undefined
        value = token
      } else {
        if (typeof token !== 'object') return undefined
        const marker = containerToken(token)
        if (!marker) return undefined
        const remainingTokens = wire.length - tokenIndex - 1
        if (marker.kind === 'array') {
          if (marker.length > remainingTokens) return undefined
          const target: CodeJsonValue[] = []
          value = target
          if (marker.length > 0) frame = { kind: 'array', target, length: marker.length, index: 0 }
        } else {
          if (marker.keys.length > remainingTokens) return undefined
          const target: Record<string, CodeJsonValue> = {}
          value = target
          if (marker.keys.length > 0) frame = { kind: 'object', target, keys: marker.keys, index: 0 }
        }
      }
      if (!attach(value)) return undefined
      if (frame) append(frames, frame)
      while (frames.length > 0) {
        const current = frames[frames.length - 1]
        /* v8 ignore next -- the loop condition guarantees a final frame. */
        if (current === undefined) break
        if (current.index < (current.kind === 'array' ? current.length : current.keys.length)) break
        takeLast(frames)
      }
    }
    return frames.length === 0 ? root : undefined
  } catch {
    return undefined
  }
}
/* jscpd:ignore-end */
