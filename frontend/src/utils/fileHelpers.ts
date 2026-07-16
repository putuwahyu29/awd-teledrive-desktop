export function fileColor(name: string) {
  const e = (name || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg','jpeg','png','gif','webp','svg','heic','heif'].includes(e)) return '#e91e63';
  if (['mp4','webm','ogg','mov','mkv'].includes(e))       return '#9c27b0';
  if (['mp3','wav','flac','aac','m4a'].includes(e))       return '#ff9800';
  if (['pdf'].includes(e))                                return '#f44336';
  if (['doc','docx','txt'].includes(e))                   return '#1a73e8';
  if (['xls','xlsx','csv'].includes(e))                   return '#34a853';
  if (['zip','rar','tar','gz','7z'].includes(e))          return '#795548';
  return '#5f6368';
}
