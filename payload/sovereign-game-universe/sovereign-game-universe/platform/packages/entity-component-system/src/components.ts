/** ECS Components — engine-neutral */
export const COMPONENTS = [
  'Transform', 'Renderable', 'Collider', 'RigidBody', 'CharacterController',
  'CameraTarget', 'AnimationState', 'Interactable', 'QuestGiver', 'DialogueActor',
  'RelationshipActor', 'InventoryHolder', 'ActivityParticipant', 'Portal',
  'Saveable', 'AudioEmitter', 'NavigationAgent', 'TimeSchedule'
] as const;
export const SYSTEMS = [
  'InputSystem', 'MovementSystem', 'CameraSystem', 'AnimationSystem', 'PhysicsSystem',
  'CollisionSystem', 'InteractionSystem', 'DialogueSystem', 'QuestSystem',
  'RelationshipSystem', 'InventorySystem', 'ActivitySystem', 'PortalSystem',
  'TimeSystem', 'AudioSystem', 'SaveSystem', 'UISynchronizationSystem'
] as const;
