export function fmtBytes(b: number, d = 1) {
  if (!+b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.log(b) <= 0 ? 0 : Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(d))} ${s[i]}`;
}
