/** Local id helper for client-side node/edge ids (workflows live in the database). */
export const uid = () => crypto.randomUUID().slice(0, 8);
