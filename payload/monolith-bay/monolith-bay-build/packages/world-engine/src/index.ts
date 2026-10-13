// @monolith/world-engine
// World/location management, portal worlds, transitions, and state.

export interface WorldDefinition {
  id: string;
  name: string;
  type: "town" | "beach" | "interior" | "portal-world";
  description: string;
  palette: { primary: string; secondary: string; accent: string };
  locations: string[];
  entryCondition?: string;
  exitCondition?: string;
  timeRules?: { pauseTime?: boolean; timeScale?: number };
}

export interface LocationDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  type: "outdoor" | "indoor" | "transit" | "special";
  connections: Array<{ targetLocationId: string; label: string; locked?: boolean; unlockCondition?: string }>;
  interactables: string[];
  characters: string[];
  timeRestrictions?: string[];
  fastTravelUnlocked?: boolean;
}

export interface PortalDefinition {
  id: string;
  fromWorldId: string;
  toWorldId: string;
  locationId: string;
  entryCondition: string;
  titleCard: string;
}

export class WorldEngine {
  private worlds = new Map<string, WorldDefinition>();
  private locations = new Map<string, LocationDefinition>();
  private portals = new Map<string, PortalDefinition>();
  private currentWorldId = "world.town";
  private currentLocationId = "location.town-square";
  private visited = new Set<string>();

  registerWorld(world: WorldDefinition) {
    this.worlds.set(world.id, world);
  }

  registerLocation(location: LocationDefinition) {
    this.locations.set(location.id, location);
  }

  registerPortal(portal: PortalDefinition) {
    this.portals.set(portal.id, portal);
  }

  getCurrentWorld(): WorldDefinition | undefined {
    return this.worlds.get(this.currentWorldId);
  }

  getCurrentLocation(): LocationDefinition | undefined {
    return this.locations.get(this.currentLocationId);
  }

  canTravelTo(locationId: string): { allowed: boolean; reason?: string } {
    const current = this.getCurrentLocation();
    if (!current) return { allowed: false, reason: "No current location." };
    const conn = current.connections.find((c) => c.targetLocationId === locationId);
    if (!conn) return { allowed: false, reason: "No direct connection." };
    if (conn.locked) return { allowed: false, reason: conn.unlockCondition ?? "Locked." };
    return { allowed: true };
  }

  travelTo(locationId: string): boolean {
    if (!this.canTravelTo(locationId).allowed) return false;
    this.currentLocationId = locationId;
    this.visited.add(locationId);
    const location = this.locations.get(locationId);
    if (location) this.currentWorldId = location.worldId;
    return true;
  }

  enterPortal(portalId: string): { success: boolean; titleCard?: string; reason?: string } {
    const portal = this.portals.get(portalId);
    if (!portal) return { success: false, reason: "Portal not found." };
    // Check entry condition against game flags (placeholder)
    this.currentWorldId = portal.toWorldId;
    this.visited.add(portal.toWorldId);
    return { success: true, titleCard: portal.titleCard };
  }

  getVisitedLocations(): string[] {
    return [...this.visited];
  }

  getWorlds(): WorldDefinition[] {
    return [...this.worlds.values()];
  }

  getLocations(worldId: string): LocationDefinition[] {
    return [...this.locations.values()].filter((l) => l.worldId === worldId);
  }
}
