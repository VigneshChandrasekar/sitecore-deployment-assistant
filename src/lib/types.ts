export type DeployMode =
  | "Overwrite"
  | "Merge"
  | "Skip"
  | "Delete"
  | "Undefined";

export type Database = "master" | "core" | "web" | string;

export type ItemType =
  | "Template"
  | "Template Field"
  | "Template Section"
  | "Rendering"
  | "Layout"
  | "Placeholder"
  | "Media"
  | "Setting"
  | "Content"
  | "Unknown";

export interface PackageMetadata {
  name: string;
  version: string;
  author: string;
  publisher: string;
  comment: string;
  readme: string;
}

export interface ItemField {
  tfid: string;
  key: string;
  type: string;
  value: string;
}

export interface SitecoreItem {
  id: string;
  name: string;
  key: string;
  path: string;
  database: Database;
  templateId: string;
  templateName: string;
  parentId: string;
  sortOrder: string;
  deployMode: DeployMode;
  itemType: ItemType;
  language: string;
  version: number;
  fields: ItemField[];
}

export interface PackageFile {
  path: string;
  size: number;
}

export interface ParsedPackage {
  metadata: PackageMetadata;
  items: SitecoreItem[];
  files: PackageFile[];
  errors: string[];
}
