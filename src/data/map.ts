interface IdentifiableGeometry {
  id?: string | number;
  properties?: Record<string, unknown> | null;
}

export function getMapEntityId(geometry: IdentifiableGeometry, idProperty: string): string | undefined {
  const property = geometry.properties?.[idProperty];
  const id = idProperty === 'id' ? geometry.id ?? property : property;
  if (typeof id === 'number') return String(id);
  if (typeof id === 'string' && id.trim()) return id;
}
