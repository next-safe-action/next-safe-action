// A local type that shares a removed name must not be touched.
type DVES = { local: true };

export const value: DVES = { local: true };
