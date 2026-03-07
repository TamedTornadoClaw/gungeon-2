import type { EntityId } from '../types';

/** Component data can be any object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentData = Record<string, any>;

/**
 * Lightweight ECS world: sparse set of component maps keyed by EntityId.
 */
export class World {
  private nextId: EntityId = 1;
  private entities: Set<EntityId> = new Set();
  /** componentName → (entityId → data) */
  private components: Map<string, Map<EntityId, ComponentData>> = new Map();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    if (!this.entities.has(id)) return;
    this.entities.delete(id);
    for (const store of this.components.values()) {
      store.delete(id);
    }
  }

  addComponent<T extends ComponentData>(id: EntityId, componentName: string, data: T): void {
    if (!this.entities.has(id)) return;
    let store = this.components.get(componentName);
    if (!store) {
      store = new Map();
      this.components.set(componentName, store);
    }
    store.set(id, data);
  }

  removeComponent(id: EntityId, componentName: string): void {
    this.components.get(componentName)?.delete(id);
  }

  getComponent<T extends ComponentData>(id: EntityId, componentName: string): T | undefined {
    return this.components.get(componentName)?.get(id) as T | undefined;
  }

  hasComponent(id: EntityId, componentName: string): boolean {
    return this.components.get(componentName)?.has(id) ?? false;
  }

  query(componentNames: string[]): EntityId[] {
    if (componentNames.length === 0) return [...this.entities];

    // Find the smallest store to iterate over
    let smallest: Map<EntityId, ComponentData> | undefined;
    let smallestSize = Infinity;
    for (const name of componentNames) {
      const store = this.components.get(name);
      if (!store || store.size === 0) return [];
      if (store.size < smallestSize) {
        smallestSize = store.size;
        smallest = store;
      }
    }
    if (!smallest) return [];

    const result: EntityId[] = [];
    for (const id of smallest.keys()) {
      if (!this.entities.has(id)) continue;
      let hasAll = true;
      for (const name of componentNames) {
        if (!this.components.get(name)!.has(id)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) result.push(id);
    }
    return result;
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  getEntityCount(): number {
    return this.entities.size;
  }
}
