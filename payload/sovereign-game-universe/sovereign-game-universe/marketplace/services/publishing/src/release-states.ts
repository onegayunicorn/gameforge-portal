/** Release state machine — no public download before all gates pass */
export const RELEASE_STATES = [
  'DRAFT', 'UPLOAD_IN_PROGRESS', 'PROCESSING', 'SCAN_PENDING', 'SCAN_FAILED',
  'READY_FOR_REVIEW', 'REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED',
  'UNPUBLISHED', 'REJECTED', 'ARCHIVED'
] as const;
export const PUBLICATION_GATES = [
  'upload_completion', 'checksum_generation', 'malware_scan',
  'metadata_validation', 'creator_ownership_validation', 'moderation_decision'
] as const;
