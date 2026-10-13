export interface ContentManifest {
  version: string;
  contentVersion: string;
  entries: Array<{
    path: string;
    sha256: string;
    size: number;
    type: string;
    provenance: string;
    license: string;
  }>;
}

export async function loadContentManifest(url: string): Promise<ContentManifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load content manifest: ${response.status}`);
  }
  return (await response.json()) as ContentManifest;
}
