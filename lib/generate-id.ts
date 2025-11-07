export function generateId(): string {
  let id = "";
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * chars.length);
    id += chars.charAt(rand);
  }
  return id;
}
