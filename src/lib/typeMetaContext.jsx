// Presentation metadata per type, shared with the components that render a
// type's icon and colour without being on the path that computes it.
//
// It is a context rather than a prop chain because the value is now DERIVED at
// render time (see lib/types.js): it changes whenever the app writes a type, so
// components deep in the tree — the properties panel, say — must read the live
// value rather than the build-time constant they used to import from content.js
// (adr/0045-manage-types-from-the-ui.md).
import React, { createContext, useContext } from 'react';

const TypeMetaContext = createContext(/** @type {Record<string, any>} */ ({}));

export function TypeMetaProvider({ value, children }) {
  return <TypeMetaContext.Provider value={value}>{children}</TypeMetaContext.Provider>;
}

// Metadata for one type name, or an empty object when nothing declares it — a
// type only the notes carry renders with the app's defaults.
//
// The lookup ignores case: a note may spell its `type:` differently from the
// Type document that declares it (`note` vs `Note`), and the app treats those as
// one type, so it must find the same icon and colour for both.
export function useTypeMeta(name) {
  return lookupTypeMeta(useContext(TypeMetaContext), name);
}

export function lookupTypeMeta(all, name) {
  if (!name || !all) return {};
  if (all[name]) return all[name];
  const key = name.trim().toLowerCase();
  for (const k of Object.keys(all)) if (k.toLowerCase() === key) return all[k];
  return {};
}

export function useAllTypeMeta() {
  return useContext(TypeMetaContext);
}
