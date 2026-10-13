// @monolith/validation
// Content schema validation, provenance checks, and asset budget enforcement.

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
  assetId?: string;
}

export type AssetOrigin =
  | "newly-authored"
  | "licensed"
  | "public-domain"
  | "open-source-compatible"
  | "procedurally-generated";

export const DISALLOWED_ORIGINS = [
  "extracted-from-download",
  "ripped-from-game",
  "converted-from-unlicensed-source",
] as const;

export interface AssetProvenance {
  assetId: string;
  file: string;
  origin: AssetOrigin;
  author: string;
  createdAt: string;
  sourceReferences: string[];
  copiedFromProtectedSource: boolean;
  license: string;
  reviewStatus: "draft" | "pending" | "approved" | "rejected";
  sha256: string;
}

export class ContentValidator {
  private issues: ValidationIssue[] = [];

  validateProvenance(asset: AssetProvenance): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!asset.assetId) {
      issues.push({ severity: "error", code: "MISSING_ID", message: "Asset is missing an ID.", path: asset.file });
    }
    if (!asset.origin || (DISALLOWED_ORIGINS as readonly string[]).includes(asset.origin)) {
      issues.push({ severity: "error", code: "DISALLOWED_ORIGIN", message: `Asset origin '${asset.origin}' is not permitted.`, assetId: asset.assetId });
    }
    if (asset.copiedFromProtectedSource) {
      issues.push({ severity: "error", code: "PROTECTED_SOURCE", message: "Asset is marked as copied from a protected source.", assetId: asset.assetId });
    }
    if (asset.reviewStatus !== "approved") {
      issues.push({ severity: "warning", code: "NOT_APPROVED", message: `Asset review status is '${asset.reviewStatus}', not 'approved'.`, assetId: asset.assetId });
    }
    if (!asset.sha256 || asset.sha256.length !== 64) {
      issues.push({ severity: "warning", code: "INVALID_CHECKSUM", message: "Asset SHA-256 checksum is missing or invalid.", assetId: asset.assetId });
    }
    return issues;
  }

  validateQuest(def: { id?: string; objectives?: unknown[] }): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!def.id) issues.push({ severity: "error", code: "QUEST_NO_ID", message: "Quest is missing an ID." });
    if (!def.objectives || def.objectives.length === 0) {
      issues.push({ severity: "error", code: "QUEST_NO_OBJECTIVES", message: `Quest '${def.id}' has no objectives.`, assetId: def.id });
    }
    return issues;
  }

  validateCharacter(char: { id?: string; provenance?: AssetProvenance }): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!char.id) issues.push({ severity: "error", code: "CHAR_NO_ID", message: "Character is missing an ID." });
    if (char.provenance) {
      issues.push(...this.validateProvenance(char.provenance));
    } else {
      issues.push({ severity: "error", code: "CHAR_NO_PROVENANCE", message: `Character '${char.id}' has no provenance record.`, assetId: char.id });
    }
    return issues;
  }

  addIssue(issue: ValidationIssue) {
    this.issues.push(issue);
  }

  getIssues(): ValidationIssue[] {
    return [...this.issues];
  }

  hasErrors(): boolean {
    return this.issues.some((i) => i.severity === "error");
  }

  reset() {
    this.issues = [];
  }
}
